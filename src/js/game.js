import { rand, choice } from './utils';

const _window = window;
const _document = document;
const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
let konamiIndex = 0;

// GAMEPLAY VARIABLES

const TITLE_SCREEN = 0;
const GAME_SCREEN = 1;
const END_SCREEN = 2;
let screen = TITLE_SCREEN;

let countdown; // in seconds
let hero;
let entities;

// RENDER VARIABLES

const CTX = c.getContext('2d');         // visible canvas
const WIDTH = 320;
const HEIGHT = 240;
const BUFFER = c.cloneNode();           // visible portion of map
const BUFFER_CTX = BUFFER.getContext('2d');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789.:!-%,/';
const ALIGN_LEFT = 0;
const ALIGN_CENTER = 1;
const ALIGN_RIGHT = 2;
const ATLAS = {
  zuchini: {
    move: [
      { x: 0, y: 0, w: 16, h: 18 },
      { x: 16, y: 0, w: 16, h: 18 },
      { x: 32, y: 0, w: 16, h: 18 },
      { x: 48, y: 0, w: 16, h: 18 },
      { x: 64, y: 0, w: 16, h: 18 },
    ],
  },
};
const CHARSET_SIZE = 8; // in px
const FRAME_DURATION = 0.1; // duration of 1 animation frame, in seconds
let charset = '';   // alphabet sprite, filled in by build script, overwritten at runtime
let tileset = '';   // characters sprite, filled in by build script, overwritten at runtime

// LOOP VARIABLES

let currentTime;
let elapsedTime;
let lastTime;
let requestId;
let running = true;

// GAMEPLAY HANDLERS

function startGame() {
  konamiIndex = 0;
  countdown = 60;
  hero = createEntity('zuchini', WIDTH / 2, HEIGHT / 2, 100);
  entities = [
    hero,
    createEntity('zuchini', 20, 20),
    createEntity('zuchini', 20, HEIGHT - 20),
    createEntity('zuchini', WIDTH - 20, 20),
    createEntity('zuchini', WIDTH - 20, HEIGHT - 20),
  ];
  screen = GAME_SCREEN;
};

function testAABBCollision(entity1, entity2) {
  const test = {
    entity1MaxX: entity1.x + entity1.w,
    entity1MaxY: entity1.y + entity1.h,
    entity2MaxX: entity2.x + entity2.w,
    entity2MaxY: entity2.y + entity2.h,
  };

  test.collide = entity1.x < test.entity2MaxX
    && test.entity1MaxX > entity2.x
    && entity1.y < test.entity2MaxY
    && test.entity1MaxY > entity2.y;

  return test;
};

// entity1 collided into entity2
function correctAABBCollision(entity1, entity2, test) {
  const { entity1MaxX, entity1MaxY, entity2MaxX, entity2MaxY } = test;

  const deltaMaxX = entity1MaxX - entity2.x;
  const deltaMaxY = entity1MaxY - entity2.y;
  const deltaMinX = entity2MaxX - entity1.x;
  const deltaMinY = entity2MaxY - entity1.y;

  // AABB collision response (homegrown wall sliding, not physically correct
  // because just pushing along one axis by the distance overlapped)

  // entity1 moving down/right
  if (entity1.moveX > 0 && entity1.moveY > 0) {
    if (deltaMaxX < deltaMaxY) {
      // collided right side first
      entity1.x -= deltaMaxX;
    } else {
      // collided top side first
      entity1.y -= deltaMaxY;
    }
  }
  // entity1 moving up/right
  else if (entity1.moveX > 0 && entity1.moveY < 0) {
    if (deltaMaxX < deltaMinY) {
      // collided right side first
      entity1.x -= deltaMaxX;
    } else {
      // collided bottom side first
      entity1.y += deltaMinY;
    }
  }
  // entity1 moving right
  else if (entity1.moveX > 0) {
    entity1.x -= deltaMaxX;
  }
  // entity1 moving down/left
  else if (entity1.moveX < 0 && entity1.moveY > 0) {
    if (deltaMinX < deltaMaxY) {
      // collided left side first
      entity1.x += deltaMinX;
    } else {
      // collided top side first
      entity1.y -= deltaMaxY;
    }
  }
  // entity1 moving up/left
  else if (entity1.moveX < 0 && entity1.moveY < 0) {
    if (deltaMinX < deltaMinY) {
      // collided left side first
      entity1.x += deltaMinX;
    } else {
      // collided bottom side first
      entity1.y += deltaMinY;
    }
  }
  // entity1 moving left
  else if (entity1.moveX < 0) {
    entity1.x += deltaMinX;
  }
  // entity1 moving down
  else if (entity1.moveY > 0) {
    entity1.y -= deltaMaxY;
  }
  // entity1 moving up
  else if (entity1.moveY < 0) {
    entity1.y += deltaMinY;
  }
};

function constrainToViewport(entity) {
  if (entity.x < 0) {
    entity.x = 0;
  } else if (entity.x > WIDTH - entity.w) {
    entity.x = WIDTH - entity.w;
  }
  if (entity.y < 0) {
    entity.y = 0;
  } else if (entity.y > HEIGHT - entity.h) {
    entity.y = HEIGHT - entity.h;
  }
};

function createEntity(type, x = 0, y = 0, speed = 20) {
  const action = 'move';
  const sprites = ATLAS[type][action];
  const frame = rand(0, sprites.length - 1);
  return {
    action,
    frame,
    frameTime: 0,
    h: sprites[frame].h,
    lastX: x,
    lastY: y,
    moveX: 0,
    moveY: 0,
    online: true,
    speed,
    type,
    w: sprites[frame].w,
    x,
    y,
  };
};

function updateLastPosition(entity) {
  entity.lastX = entity.x;
  entity.lastY = entity.y;
};

function updatePosition(entity) {
  // update animation frame
  entity.frameTime += elapsedTime;
  if (entity.frameTime > FRAME_DURATION) {
    entity.frameTime -= FRAME_DURATION;
    entity.frame += 1;
    entity.frame %= ATLAS[entity.type][entity.action].length;
  }
  // update position
  const distance = entity.speed * elapsedTime;
  entity.x += distance * entity.moveX;
  entity.y += distance * entity.moveY;
};

function updateDirection(entity) {
  let { lastDirection = 0 } = entity;
  lastDirection += elapsedTime;
  if (Math.random() < lastDirection / 10) {
    entity[`move${Math.random() < 0.5 ? 'X' : 'Y'}`] = choice([-1, 0, 1]);
    lastDirection = 0;
  }
  entity.lastDirection = lastDirection;
};

function update() {
  switch (screen) {
    case GAME_SCREEN:
      countdown -= elapsedTime;
      if (countdown < 0) {
        screen = END_SCREEN;
      }
      updatePosition(hero);
      constrainToViewport(hero);
      entities.slice(1).forEach((entity) => {
        updateDirection(entity);
        updatePosition(entity);
        const test = testAABBCollision(hero, entity);
        if (test.collide) {
          correctAABBCollision(hero, entity, test);
        }
        if (hero.switchMode && hero.online) {
          updateLastPosition(entity);
        }
        constrainToViewport(entity);
      });
      if (hero.switchMode) {
        hero.switchMode = false;
        hero.online = !hero.online;
      }
      break;
  }
};

// RENDER HANDLERS

function blit() {
  // copy backbuffer onto visible canvas, scaling it to screen dimensions
  CTX.drawImage(
    BUFFER,
    0, 0, WIDTH, HEIGHT,
    0, 0, c.width, c.height
  );
};

function render() {
  BUFFER_CTX.fillStyle = '#fff';
  BUFFER_CTX.fillRect(0, 0, WIDTH, HEIGHT);

  switch (screen) {
    case TITLE_SCREEN:
      renderText('subwar 2051', CHARSET_SIZE, CHARSET_SIZE);
      renderText('press any key', WIDTH / 2, HEIGHT / 2, ALIGN_CENTER);
      if (konamiIndex === konamiCode.length) {
        renderText('konami mode on', WIDTH - CHARSET_SIZE, CHARSET_SIZE, ALIGN_RIGHT);
      }
      break;
    case GAME_SCREEN:
      renderText(`sonar: ${hero.online ? 'on' : 'off'}line`, CHARSET_SIZE, CHARSET_SIZE);
      renderCountdown();
      // uncomment to debug mobile input handlers
      // renderDebugTouch();
      entities.forEach(renderEntity);
      break;
    case END_SCREEN:
      renderText('game over', CHARSET_SIZE, CHARSET_SIZE);
      break;
  }

  blit();
};

function renderCountdown() {
  const minutes = Math.floor(Math.ceil(countdown) / 60);
  const seconds = Math.ceil(countdown) - minutes * 60;
  renderText(`${minutes}:${seconds <= 9 ? '0' : ''}${seconds}`, WIDTH - CHARSET_SIZE, CHARSET_SIZE, ALIGN_RIGHT);

};

function renderEntity(entity) {
  const sprite = ATLAS[entity.type][entity.action][entity.frame];
  const x = (hero.online && entity.online || hero === entity) ? entity.x : entity.lastX;
  const y = (hero.online && entity.online || hero === entity) ? entity.y : entity.lastY;
  BUFFER_CTX.drawImage(
    tileset,
    sprite.x, sprite.y, sprite.w, sprite.h,
    Math.round(x), Math.round(y), sprite.w, sprite.h
  );
};

function renderText(msg, x, y, align = ALIGN_LEFT, scale = 1) {
  const SCALED_SIZE = scale * CHARSET_SIZE;
  const MSG_WIDTH = msg.length * SCALED_SIZE;
  const ALIGN_OFFSET = align === ALIGN_RIGHT ? MSG_WIDTH :
                       align === ALIGN_CENTER ? MSG_WIDTH / 2 :
                       0;
  [...msg].forEach((c, i) => {
    BUFFER_CTX.drawImage(
      charset,
      // TODO could memoize the characters index or hardcode a lookup table
      ALPHABET.indexOf(c)*CHARSET_SIZE, 0, CHARSET_SIZE, CHARSET_SIZE,
      x + i*SCALED_SIZE - ALIGN_OFFSET, y, SCALED_SIZE, SCALED_SIZE
    );
  });
};

// LOOP HANDLERS

function loop() {
  if (running) {
    requestId = requestAnimationFrame(loop);
    render();
    currentTime = Date.now();
    elapsedTime = (currentTime - lastTime) / 1000;
    update();
    lastTime = currentTime;
  }
};

function toggleLoop(value) {
  running = value;
  if (running) {
    lastTime = Date.now();
    loop();
  } else {
    cancelAnimationFrame(requestId);
  }
};

// EVENT HANDLERS

onload = async (e) => {
  // the real "main" of the game
  _document.title = 'Subwar 2051';

  onresize();

  charset = await loadImg(charset);
  tileset = await loadImg(tileset);
  toggleLoop(true);
};

onresize = _window.onrotate = function() {
  BUFFER.width = WIDTH;
  BUFFER.height = HEIGHT;

  // scale canvas to fit screen while maintaining aspect ratio
  const scaleToFit = Math.min(innerWidth / WIDTH, innerHeight / HEIGHT);
  c.width = WIDTH * scaleToFit;
  c.height = HEIGHT * scaleToFit;
  // disable smoothing on image scaling
  CTX.imageSmoothingEnabled = BUFFER_CTX.imageSmoothingEnabled = false;
};

// UTILS

_document.onvisibilitychange = function(e) {
  // pause loop and game timer when switching tabs
  toggleLoop(!e.target.hidden);
};

function loadImg(dataUri) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      resolve(img);
    };
    img.src = dataUri;
  });
};

// INPUT HANDLERS

onkeydown = function(e) {
  // prevent itch.io from scrolling the page up/down
  e.preventDefault();

  if (!e.repeat) {
    switch (screen) {
      case GAME_SCREEN:
        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
            hero.moveX = -1;
            break;
          case 'ArrowUp':
          case 'KeyW':
            hero.moveY = -1;
            break;
          case 'ArrowRight':
          case 'KeyD':
            hero.moveX = 1;
            break;
          case 'ArrowDown':
          case 'KeyS':
            hero.moveY = 1;
            break;
          case 'KeyP':
            // Pause game as soon as key is pressed
            toggleLoop(!running);
            break;
        }
        break;
    }
  }
};

onkeyup = function(e) {
  switch (screen) {
    case TITLE_SCREEN:
      if (e.which !== konamiCode[konamiIndex] || konamiIndex === konamiCode.length) {
        startGame();
      } else {
        konamiIndex++;
      }
      break;
    case GAME_SCREEN:
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
        case 'ArrowRight':
        case 'KeyD':
          hero.moveX = 0;
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'ArrowDown':
        case 'KeyS':
          hero.moveY = 0;
          break;
        case 'KeyO': // when playing with arrows
        case 'KeyY': // when playing with WASD
          hero.switchMode = true;
          break;
      }
      break;
    case END_SCREEN:
      switch (e.code) {
        case 'KeyT':
          open(`https://twitter.com/intent/tweet?text=viral%20marketing%20message%20https%3A%2F%2Fgoo.gl%2F${'some tiny Google url here'}`, '_blank');
          break;
        default:
          screen = TITLE_SCREEN;
          break;
      }
      break;
  }
};

// MOBILE INPUT HANDLERS

let minX = 0;
let minY = 0;
let maxX = 0;
let maxY = 0;
let MIN_DISTANCE = 30; // in px
let touches = [];

// adding onmousedown/move/up triggers a MouseEvent and a PointerEvent
// on platform that support both (duplicate event, pointer > mouse || touch)
_window.ontouchstart = _window.onpointerdown = function(e) {
  e.preventDefault();
  switch (screen) {
    case GAME_SCREEN:
      [maxX, maxY] = [minX, minY] = pointerLocation(e);
      break;
  }
};

_window.ontouchmove = _window.onpointermove = function(e) {
  e.preventDefault();
  switch (screen) {
    case GAME_SCREEN:
      if (minX && minY) {
        setTouchPosition(pointerLocation(e));
      }
      break;
  }
}

_window.ontouchend = _window.onpointerup = function(e) {
  e.preventDefault();
  switch (screen) {
    case TITLE_SCREEN:
      startGame();
      break;
    case GAME_SCREEN:
      // stop hero
      hero.moveX = hero.moveY = 0;
      // end touch
      minX = minY = maxX = maxY = 0;
      break;
    case END_SCREEN:
      screen = TITLE_SCREEN;
      break;
  }
};

// utilities
function pointerLocation(e) {
  return [e.pageX || e.changedTouches[0].pageX, e.pageY || e.changedTouches[0].pageY];
};

function setTouchPosition([x, y]) {
  // touch moving further right
  if (x > maxX) {
    maxX = x;
    if (maxX - minX > MIN_DISTANCE) {
      hero.moveX = 1;
    }
  }
  // touch moving further left
  else if (x < minX) {
    minX = x;
    if (maxX - minX > MIN_DISTANCE) {
      hero.moveX = -1;
    }
  }
  // touch reversing left while hero moving right
  else if (x < maxX && hero.moveX > 0) {
    minX = x;
    hero.moveX = 0;
  }
  // touch reversing right while hero moving left
  else if (minX < x && hero.moveX < 0) {
    maxX = x;
    hero.moveX = 0;
  }

  // touch moving further down
  if (y > maxY) {
    maxY = y;
    if (maxY - minY > MIN_DISTANCE) {
      hero.moveY = 1;
    }
  }
  // touch moving further up
  else if (y < minY) {
    minY = y;
    if (maxY - minY > MIN_DISTANCE) {
      hero.moveY = -1;
    }
  }
  // touch reversing up while hero moving down
  else if (y < maxY && hero.moveY > 0) {
    minY = y;
    hero.moveY = 0;
  }
  // touch reversing down while hero moving up
  else if (minY < y && hero.moveY < 0) {
    maxY = y;
    hero.moveY = 0;
  }

  // uncomment to debug mobile input handlers
  // addDebugTouch(x, y);
};

function addDebugTouch(x, y) {
  touches.push([x / innerWidth * WIDTH, y / innerHeight * HEIGHT]);
  if (touches.length > 10) {
    touches = touches.slice(touches.length - 10);
  }
};

function renderDebugTouch() {
  let x = maxX / innerWidth * WIDTH;
  let y = maxY / innerHeight * HEIGHT;
  renderDebugTouchBound(x, x, 0, HEIGHT, '#f00');
  renderDebugTouchBound(0, WIDTH, y, y, '#f00');
  x = minX / innerWidth * WIDTH;
  y = minY / innerHeight * HEIGHT;
  renderDebugTouchBound(x, x, 0, HEIGHT, '#ff0');
  renderDebugTouchBound(0, WIDTH, y, y, '#ff0');

  if (touches.length) {
    BUFFER_CTX.strokeStyle = BUFFER_CTX.fillStyle =   '#02d';
    BUFFER_CTX.beginPath();
    [x, y] = touches[0];
    BUFFER_CTX.moveTo(x, y);
    touches.forEach(function([x, y]) {
      BUFFER_CTX.lineTo(x, y);
    });
    BUFFER_CTX.stroke();
    BUFFER_CTX.closePath();
    BUFFER_CTX.beginPath();
    [x, y] = touches[touches.length - 1];
    BUFFER_CTX.arc(x, y, 2, 0, 2 * Math.PI)
    BUFFER_CTX.fill();
    BUFFER_CTX.closePath();
  }
};

function renderDebugTouchBound(_minX, _maxX, _minY, _maxY, color) {
  BUFFER_CTX.strokeStyle = color;
  BUFFER_CTX.beginPath();
  BUFFER_CTX.moveTo(_minX, _minY);
  BUFFER_CTX.lineTo(_maxX, _maxY);
  BUFFER_CTX.stroke();
  BUFFER_CTX.closePath();
};
