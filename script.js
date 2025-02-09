let startTime;
let elapsedInterval;
let estimatedTime = 40; // Estimated time in seconds
let images = []

const loadedImages = [];
function preloadImages(base64Images) {
  return Promise.all(base64Images.map(base64 => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      const base64Data = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
      img.src = base64Data;
    });
  }));
}

let storedBase64 = [];

function updateButtonImages(base64Images) {
  // Create a style element if it doesn't exist
  let styleEl = document.getElementById('dynamic-button-styles');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-button-styles';
    document.head.appendChild(styleEl);
  }

  // Create the CSS rules using the base64 images
  const css = `
    .upgrade-item button {
      position: relative;
      padding-left: 50px;
    }

    .upgrade-item button::before {
      content: '';
      position: absolute;
      left: 5px;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      background-size: cover !important;
      background-position: center !important;
    }

    .upgrade-item button[onclick*="doublePoints"]::before {
      background: url(${"data:image/png;base64," + base64Images[0]}) no-repeat;
    }

    .upgrade-item button[onclick*="autoClicker"]::before {
      background: url(${"data:image/png;base64," + base64Images[1]}) no-repeat;
    }

    .upgrade-item button[onclick*="smartBrain"]::before {
      background: url(${"data:image/png;base64," + base64Images[2]}) no-repeat;
    }

    .upgrade-item button[onclick*="autoSolver"]::before {
      background: url(${"data:image/png;base64," + base64Images[3]}) no-repeat;
    }
  `;

  // Update the style element's content
  styleEl.textContent = css;
}

async function submitTopic() {
  const topic = document.getElementById('topicInput').value;
  if (!topic) {
      alert('Please enter a topic');
      return;
  }

  document.getElementById("loadingSpinner").style.display = "block";
  document.getElementById("topicInput").disabled = true;
  startTime = Date.now();
  document.getElementById("etaDisplay").textContent = `Estimated: ${estimatedTime}s`;
  elapsedInterval = setInterval(() => {
    let elapsed = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById("elapsedTime").textContent = `${elapsed}s`;
  }, 1000);

  try {
      // First request
      const response = await fetch('https://trivy-study.loca.lt/generate-questions', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'bypass-tunnel-reminder': 'Hello'
          },
          body: JSON.stringify({ topic: topic })
      });

      if (!response.ok) {
          throw new Error('Network response was not ok');
      }
      const data = await response.json();

      // Second request
      const response1 = await fetch('https://trivy-study.loca.lt/generate-upgrades', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'Hello'
        },
        body: JSON.stringify({ topic: topic })
      });

      if (!response1.ok) {
          throw new Error('Network response was not ok');
      }
      const data1 = await response1.json();

      updateButtonImages(data1);
      processReceivedQuestions(data);

      const images = data1; // Ensure images are properly extracted

      // Preload and store images
      preloadImages(images).then((loadedImages) => {
          window.loadedImages = loadedImages;
          console.log("Loaded images:", window.loadedImages); // Ensure it's populated
      }).catch(error => {
          console.error('Failed to preload images:', error);
      });

      document.getElementById('topicOverlay').style.display = 'none';
      document.getElementById('gameContainer').style.display = 'block';
  } catch (error) {
      console.error('Error:', error);
      alert('Error loading questions. Please try again.');
  } finally {
      clearInterval(elapsedInterval);
      document.getElementById("loadingSpinner").style.display = "none";
      document.getElementById("topicInput").disabled = false;
  }
}


function processReceivedQuestions(data) {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  
  // Set canvas size
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  
  let gameState = {
    points: 100,
    pointsPerAnswer: 1,
    autoPointsPerSecond: 0,
    buildings: [],
    upgrades: {
      doublePoints: { cost: 10, level: 0, multiplier: 2 },
      autoClicker: { cost: 30, level: 0, pointsPerSecond: 0.1 },
      smartBrain: { cost: 50, level: 0, multiplier: 1.5 },
      autoSolver: { cost: 100, level: 0, pointsPerSecond: 1 }
    }
  };

  function convertToValidJSON(inputString) {
    if (!inputString || typeof inputString !== 'string') {
        console.warn('Invalid input: Input must be a non-empty string');
        return null;
    }

    try {
        // Step 1: Clean up the input string
        let processedString = inputString
            .trim()
            // Remove multiple spaces
            .replace(/\s+/g, ' ')
            // Fix missing commas between objects
            .replace(/}(\s*){/g, '},{')
            // Fix missing commas between array items
            .replace(/](\s*)\[/g, '],[');

        // Step 2: Ensure the string is wrapped in square brackets
        if (!processedString.startsWith('[')) {
            processedString = '[' + processedString;
        }
        if (!processedString.endsWith(']')) {
            processedString = processedString + ']';
        }

        // Step 3: Add quotes around property names that need them
        processedString = processedString.replace(/(\b\w+\b)(?=\s*:)/g, '"$1"');

        // Step 4: Fix common quote issues
        processedString = processedString
            // Replace smart quotes with straight quotes
            .replace(/[""]/g, '"')
            .replace(/['']/g, "'")
            // Ensure property values have quotes if they're strings
            .replace(/:(\s*)([\w-]+)(?=\s*[,}\]])/g, ':"$2"')
            // Fix escaped quotes
            .replace(/\\"/g, '"')
            .replace(/(?<!\\)"/g, '\\"')
            .replace(/\\\\"/g, '\\"');

        // Step 5: Fix common bracket issues
        let bracketCount = 0;
        for (let char of processedString) {
            if (char === '[') bracketCount++;
            if (char === ']') bracketCount--;
        }
        // Add missing closing brackets
        while (bracketCount > 0) {
            processedString += ']';
            bracketCount--;
        }
        // Add missing opening brackets
        while (bracketCount < 0) {
            processedString = '[' + processedString;
            bracketCount++;
        }

        // Step 6: Handle trailing commas
        processedString = processedString
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/,\s*$/g, '');

        // Step 7: Try to parse the JSON
        try {
            return JSON.parse(processedString);
        } catch (initialError) {
            // If parsing fails, try additional cleanup
            processedString = processedString
                // Remove invalid control characters
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                // Fix missing quotes around string values
                .replace(/:(\s*)([^{[\d]\w+)([,}\]])/g, ':"$2"$3')
                // Remove duplicate commas
                .replace(/,+/g, ',')
                // Remove comma before closing bracket
                .replace(/,(\s*])/g, '$1');

            // Final parsing attempt
            return JSON.parse(processedString);
        }
    } catch (error) {
        console.warn('Failed to convert string to JSON:', error.message);
        // Return partial data if possible
        try {
            // Try to extract valid objects from the string
            const matches = inputString.match(/({[^}]+})/g);
            if (matches) {
                return matches.map(str => {
                    try {
                        return JSON.parse(str);
                    } catch {
                        return null;
                    }
                }).filter(Boolean);
            }
        } catch {
            // If all else fails, return null
            return null;
        }
        return null;
    }
}

  const questions = convertToValidJSON(data, null, 2);

  console.log(questions)
//   const questions_1 = [
//     {
//       question: "What is 2 + 2?",
//       answer: "4",
//       options: ["3", "4", "5", "6"]
//     },
//     {
//       question: "Which planet is closest to the Sun?",
//       answer: "Mercury",
//       options: ["Venus", "Mercury", "Mars", "Earth"]
//     },
//     {
//       question: "What is the capital of France?",
//       answer: "Paris",
//       options: ["London", "Berlin", "Paris", "Madrid"]
//     },
//     {
//       question: "How many continents are there?",
//       answer: "7",
//       options: ["5", "6", "7", "8"]
//     }
//   ];
  
//   console.log(typeof(questions))

  let currentQuestion = 0;
  
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num);
  }
  
  function calculateUpgradeCost(upgrade) {
    return Math.floor(upgrade.cost * Math.pow(1.15, upgrade.level));
  }
  
  function displayQuestion() {
    const question = questions[currentQuestion];
    document.getElementById('question').innerHTML = `
      <div class="question-card">
        <h3>${question.question}</h3>
      </div>
    `;
  
    const optionsContainer = document.getElementById('options');
    optionsContainer.innerHTML = '';
  
    question.options.forEach(option => {
      const button = document.createElement('button');
      button.textContent = option;
      button.onclick = () => checkAnswer(option);
      optionsContainer.appendChild(button);
    });
  }
  
  function checkAnswer(selected) {
    const answer = questions[currentQuestion].answer;
    const buttons = document.querySelectorAll('.options button');
    const mainContent = document.querySelector('.question-section');
  
    buttons.forEach(button => button.disabled = true);
  
    if (selected === answer) {
      gameState.points += gameState.pointsPerAnswer;
      updateDisplay();
      mainContent.classList.add('correct'); // Add green highlight
    } else {
      mainContent.classList.add('wrong'); // Add red highlight
    }
  
    setTimeout(() => {
      mainContent.classList.remove('correct', 'wrong'); // Remove highlight after delay
      currentQuestion = (currentQuestion + 1) % questions.length;
      buttons.forEach(button => button.disabled = false);
      displayQuestion();
    }, 1000);
  }
  
  function updateDisplay() {
    document.getElementById('points').textContent = formatNumber(gameState.points);
    document.getElementById('pointsPerAnswer').textContent = formatNumber(gameState.pointsPerAnswer);
    document.getElementById('autoPointsPerSecond').textContent = formatNumber(gameState.autoPointsPerSecond);
  
    Object.entries(gameState.upgrades).forEach(([key, upgrade]) => {
      const cost = calculateUpgradeCost(upgrade);
      document.getElementById(`${key}Cost`).textContent = formatNumber(cost);
      document.getElementById(`${key}Level`).textContent = upgrade.level;
    });
  }
  
  function addBuilding(type, level) {
    gameState.buildings.push({
      type,
      level
    });
  }
  
  let scrollOffset = 0;
  const VIRTUAL_WIDTH = 2000;
  
  let mouseX = 0;
  let mouseY = 0;
  let isDragging = false;
  let lastDragX = 0;
  let dragStartX = 0;
  
  // Preload images first

  const drawBuildingsOnPlanes = (ctx, planes, buildingsByPlane) => {
    if (!window.loadedImages || window.loadedImages.length === 0) {
      console.error("Images are not loaded yet!");
      return;
    }
    
    const gridSize = 80;
    const spacing = 20;
    const effectiveSize = gridSize - spacing;
    const layerOffset = 30;
    const xOffset = 15;
    
    planes.forEach((plane, planeIndex) => {
      const buildings = buildingsByPlane[plane];
      const yOffset = planeIndex * layerOffset;
    
      buildings.forEach(building => {
        const col = Math.floor(building.index / 3);
        const row = building.index % 3;
    
        // Calculate position with proper offsets
        const x = col * (gridSize + xOffset) + spacing / 2 + (planeIndex * 15);
        const y = 80 + yOffset + (col % 2) * 10;
        
        const imageIndex = parseInt(building.type) - 1;
        
        // Draw shadow (small ellipse at the feet of the building)
        const shadowWidth = effectiveSize * 0.8;
        const shadowHeight = effectiveSize * 0.25;
        const shadowX = x + (effectiveSize - shadowWidth) / 2;
        const shadowY = y + effectiveSize - shadowHeight / 4;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(shadowX + shadowWidth / 2, shadowY + shadowHeight / 2, shadowWidth / 2, shadowHeight / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (
          imageIndex >= 0 &&
          imageIndex < window.loadedImages.length &&
          window.loadedImages[imageIndex] &&
          window.loadedImages[imageIndex].complete // Ensure the image is fully loaded
        ) {
          ctx.drawImage(window.loadedImages[imageIndex], x, y, effectiveSize, effectiveSize);
        } else {
          // Debugging: Log errors if images aren't displaying properly
          console.warn(`Missing or incomplete image for type ${building.type} at index ${imageIndex}`);
          if (window.loadedImages[imageIndex]) {
            console.warn(`Image at index ${imageIndex} has src: ${window.loadedImages[imageIndex].src}`);
          }
    
          // Draw a placeholder if the image isn't available
          ctx.fillStyle = '#FF0000';
          ctx.fillRect(x, y, effectiveSize, effectiveSize);
        }
      });
    });
  };  
  

function renderBuildings() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 300;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background planes
  ctx.save();
  ctx.translate(-scrollOffset, 0);

  ctx.fillStyle = '#444';
  ctx.fillRect(0, 0, VIRTUAL_WIDTH, canvas.height);

  ctx.fillStyle = '#555';
  ctx.fillRect(0, 20, VIRTUAL_WIDTH, canvas.height);

  ctx.fillStyle = '#666';
  ctx.fillRect(0, 40, VIRTUAL_WIDTH, canvas.height);

  // Sort buildings by plane for proper rendering
  const buildingsByPlane = {
    background: [],
    middle: [],
    foreground: []
  };

  gameState.buildings.forEach((building, index) => {
    const plane = index % 3 === 0 ? 'background' : 
                 index % 3 === 1 ? 'middle' : 
                 'foreground';
    buildingsByPlane[plane].push({ ...building, index });
  });

  // Draw buildings by plane from back to front
  const planes = ['background', 'middle', 'foreground'];
  drawBuildingsOnPlanes(ctx, planes, buildingsByPlane, images);

  ctx.restore();
}



  window.buyUpgrade = function (upgradeName) {
    const upgrade = gameState.upgrades[upgradeName];
    const cost = calculateUpgradeCost(upgrade);
  
    if (gameState.points >= cost) {
      gameState.points -= cost;
      upgrade.level++;
  
      switch (upgradeName) {
        case 'doublePoints':
          gameState.pointsPerAnswer *= upgrade.multiplier;
          addBuilding('1', gameState.buildings.length);
          break;
        case 'autoClicker':
          gameState.autoPointsPerSecond += upgrade.pointsPerSecond;
          addBuilding('2', gameState.buildings.length);
          break;
        case 'smartBrain':
          gameState.pointsPerAnswer *= upgrade.multiplier;
          addBuilding('3', gameState.buildings.length);
          break;
        case 'autoSolver':
          gameState.autoPointsPerSecond += upgrade.pointsPerSecond;
          addBuilding('4', gameState.buildings.length);
          break;
      }
  
      const lastBuildingIndex = gameState.buildings.length - 1;
      const lastBuildingCol = Math.floor(lastBuildingIndex / 3);
      const gridSize = 80;
      const xOffset = 15;
      const targetX = lastBuildingCol * (gridSize + xOffset);
      scrollOffset = Math.max(0, Math.min(targetX - canvas.width / 2, VIRTUAL_WIDTH - canvas.width));
  
      renderBuildings();
      updateDisplay();
    }
  }
  
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    isDragging = true;
    dragStartX = e.clientX - rect.left;
    lastDragX = dragStartX;
    mouseX = dragStartX;
    mouseY = e.clientY - rect.top;
    canvas.style.cursor = 'grabbing';
    renderBuildings();
  });
  
  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
    renderBuildings();
  });
  
  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
    renderBuildings();
  });
  
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  
    if (isDragging) {
      const deltaX = lastDragX - mouseX;
      lastDragX = mouseX;
  
      scrollOffset = Math.max(0, Math.min(scrollOffset + deltaX, VIRTUAL_WIDTH - canvas.width));
    }
  
    renderBuildings();
  });
  
  // Set initial cursor style
  canvas.style.cursor = 'grab';
  
  
  setInterval(() => {
    gameState.points += gameState.autoPointsPerSecond;
    updateDisplay();
  }, 1000);
  
  function gameLoop() {
    renderBuildings();
    requestAnimationFrame(gameLoop);
  }
  
  displayQuestion();
  updateDisplay();
  gameLoop();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    canvas.height = canvas.offsetHeight;
    renderBuildings();
  });
}