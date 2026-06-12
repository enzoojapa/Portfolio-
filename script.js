// Scroll-reveal for sections (progressive enhancement)
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealEls = document.querySelectorAll('.reveal');
  if (!prefersReduced && 'IntersectionObserver' in window) {
    revealEls.forEach(el => el.classList.add('pre-reveal'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('pre-reveal');
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => observer.observe(el));
  }
// Shader Background Implementation
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('shader-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl');
  if (!gl) {
    console.warn('WebGL not supported.');
    return;
  }

  // Vertex shader source code
  const vsSource = `
    attribute vec4 aVertexPosition;
    void main() {
      gl_Position = aVertexPosition;
    }
  `;

  // Fragment shader source code
  const fsSource = `
    precision highp float;
    uniform vec2 iResolution;
    uniform float iTime;

    const float overallSpeed = 0.2;
    const float gridSmoothWidth = 0.015;
    const float axisWidth = 0.05;
    const float majorLineWidth = 0.025;
    const float minorLineWidth = 0.0125;
    const float majorLineFrequency = 5.0;
    const float minorLineFrequency = 1.0;
    const vec4 gridColor = vec4(0.5);
    const float scale = 5.0;
    const vec4 lineColor = vec4(0.4, 0.7, 0.5, 1.0); // Soft pastel green
    const float minLineWidth = 0.01;
    const float maxLineWidth = 0.2;
    const float lineSpeed = 1.0 * overallSpeed;
    const float lineAmplitude = 1.0;
    const float lineFrequency = 0.2;
    const float warpSpeed = 0.2 * overallSpeed;
    const float warpFrequency = 0.5;
    const float warpAmplitude = 1.0;
    const float offsetFrequency = 0.5;
    const float offsetSpeed = 1.33 * overallSpeed;
    const float minOffsetSpread = 0.6;
    const float maxOffsetSpread = 2.0;
    const int linesPerGroup = 16;

    #define drawCircle(pos, radius, coord) smoothstep(radius + gridSmoothWidth, radius, length(coord - (pos)))
    #define drawSmoothLine(pos, halfWidth, t) smoothstep(halfWidth, 0.0, abs(pos - (t)))
    #define drawCrispLine(pos, halfWidth, t) smoothstep(halfWidth + gridSmoothWidth, halfWidth, abs(pos - (t)))
    #define drawPeriodicLine(freq, width, t) drawCrispLine(freq / 2.0, width, abs(mod(t, freq) - (freq) / 2.0))

    float drawGridLines(float axis) {
      return drawCrispLine(0.0, axisWidth, axis)
            + drawPeriodicLine(majorLineFrequency, majorLineWidth, axis)
            + drawPeriodicLine(minorLineFrequency, minorLineWidth, axis);
    }

    float drawGrid(vec2 space) {
      return min(1.0, drawGridLines(space.x) + drawGridLines(space.y));
    }

    float random(float t) {
      return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;
    }

    float getPlasmaY(float x, float horizontalFade, float offset) {
      return random(x * lineFrequency + iTime * lineSpeed) * horizontalFade * lineAmplitude + offset;
    }

    void main() {
      vec2 fragCoord = gl_FragCoord.xy;
      vec4 fragColor;
      vec2 uv = fragCoord.xy / iResolution.xy;
      vec2 space = (fragCoord - iResolution.xy / 2.0) / iResolution.x * 2.0 * scale;

      float horizontalFade = 1.0 - (cos(uv.x * 6.28) * 0.5 + 0.5);
      float verticalFade = 1.0 - (cos(uv.y * 6.28) * 0.5 + 0.5);

      space.y += random(space.x * warpFrequency + iTime * warpSpeed) * warpAmplitude * (0.5 + horizontalFade);
      space.x += random(space.y * warpFrequency + iTime * warpSpeed + 2.0) * warpAmplitude * horizontalFade;

      vec4 lines = vec4(0.0);
      vec4 bgColor1 = vec4(0.02, 0.06, 0.03, 1.0); // Very dark subtle green
      vec4 bgColor2 = vec4(0.04, 0.1, 0.06, 1.0);  // Dark subtle green

      for(int l = 0; l < linesPerGroup; l++) {
        float normalizedLineIndex = float(l) / float(linesPerGroup);
        float offsetTime = iTime * offsetSpeed;
        float offsetPosition = float(l) + space.x * offsetFrequency;
        float rand = random(offsetPosition + offsetTime) * 0.5 + 0.5;
        float halfWidth = mix(minLineWidth, maxLineWidth, rand * horizontalFade) / 2.0;
        float offset = random(offsetPosition + offsetTime * (1.0 + normalizedLineIndex)) * mix(minOffsetSpread, maxOffsetSpread, horizontalFade);
        float linePosition = getPlasmaY(space.x, horizontalFade, offset);
        float line = drawSmoothLine(linePosition, halfWidth, space.y) / 2.0 + drawCrispLine(linePosition, halfWidth * 0.15, space.y);

        float circleX = mod(float(l) + iTime * lineSpeed, 25.0) - 12.0;
        vec2 circlePosition = vec2(circleX, getPlasmaY(circleX, horizontalFade, offset));
        float circle = drawCircle(circlePosition, 0.01, space) * 4.0;

        line = line + circle;
        lines += line * lineColor * rand;
      }

      fragColor = mix(bgColor1, bgColor2, uv.x);
      fragColor *= verticalFade;
      fragColor.a = 1.0;
      fragColor += lines;

      gl_FragColor = fragColor;
    }
  `;

  // Helper function to compile shader
  const loadShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error: ', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  // Initialize shader program
  const initShaderProgram = (gl, vsSource, fsSource) => {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      console.error('Shader program link error: ', gl.getProgramInfoLog(shaderProgram));
      return null;
    }

    return shaderProgram;
  };

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positions = [
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
     1.0,  1.0,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      resolution: gl.getUniformLocation(shaderProgram, 'iResolution'),
      time: gl.getUniformLocation(shaderProgram, 'iTime'),
    },
  };

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    // Limit height to roughly the hero section so we don't render off-screen unnecessarily
    canvas.height = window.innerHeight; 
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  let startTime = Date.now();
  const render = () => {
    const currentTime = (Date.now() - startTime) / 1000;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height);
    gl.uniform1f(programInfo.uniformLocations.time, currentTime);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(
      programInfo.attribLocations.vertexPosition,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
});

// NavHeader Animation Logic
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.animated-nav');
  const cursor = document.querySelector('.nav-cursor');
  const tabs = document.querySelectorAll('.nav-tab');

  if (nav && cursor && tabs.length > 0) {
    tabs.forEach(tab => {
      tab.addEventListener('mouseenter', () => {
        const rect = tab.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        
        cursor.style.width = `${rect.width}px`;
        // We use offsetLeft for position relative to the ul
        cursor.style.transform = `translateX(${tab.offsetLeft}px)`;
        cursor.style.opacity = '1';
      });
    });

    nav.addEventListener('mouseleave', () => {
      cursor.style.opacity = '0';
    });
  }
});

// Pixel Cursor Trail Logic
document.addEventListener('DOMContentLoaded', () => {
  if (window.matchMedia("(pointer: coarse)").matches) return; // Skip on touch devices

  const PIXEL_SIZE = 12;
  const TRAIL_LENGTH = 40;
  const FADE_SPEED = 0.04;
  
  let pixels = [];
  let pixelId = 0;
  let lastPosition = { x: 0, y: 0 };
  let animationFrameId;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9998';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  const createPixel = (x, y) => {
    const el = document.createElement('div');
    el.className = 'pixel-trail-pixel';
    container.appendChild(el);
    return {
      id: pixelId++,
      x,
      y,
      opacity: 1,
      age: 0,
      element: el
    };
  };

  document.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;

    const dx = x - lastPosition.x;
    const dy = y - lastPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > PIXEL_SIZE) {
      const newPixel = createPixel(x, y);
      pixels.push(newPixel);

      if (pixels.length > TRAIL_LENGTH) {
        const oldest = pixels.shift();
        if (oldest.element && oldest.element.parentNode) {
          oldest.element.parentNode.removeChild(oldest.element);
        }
      }

      lastPosition = { x, y };
    }
  });

  const animate = () => {
    for (let i = pixels.length - 1; i >= 0; i--) {
      const p = pixels[i];
      p.opacity -= FADE_SPEED;
      p.age += 1;

      if (p.opacity <= 0) {
        if (p.element && p.element.parentNode) {
          p.element.parentNode.removeChild(p.element);
        }
        pixels.splice(i, 1);
      } else {
        const sizeMultiplier = Math.max(0.3, 1 - p.age / 100);
        const currentSize = PIXEL_SIZE * sizeMultiplier;

        p.element.style.left = `${p.x - currentSize / 2}px`;
        p.element.style.top = `${p.y - currentSize / 2}px`;
        p.element.style.width = `${currentSize}px`;
        p.element.style.height = `${currentSize}px`;
        p.element.style.opacity = p.opacity;
      }
    }
    animationFrameId = requestAnimationFrame(animate);
  };

  animationFrameId = requestAnimationFrame(animate);
});
