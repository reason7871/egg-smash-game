// 简单的彩带特效实现
(function() {
  let canvas = null;
  let ctx = null;
  let particles = [];
  let animationId = null;
  let isActive = false;

  const colors = [
    '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3',
    '#54a0ff', '#5f27cd', '#00d2d3', '#1dd1a1'
  ];

  function createCanvas() {
    canvas = document.createElement('canvas');
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    document.body.appendChild(canvas);
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: -20,
      size: Math.random() * 10 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 3 + 2,
      speedX: Math.random() * 4 - 2,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 10 - 5
    };
  }

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 添加新粒子
    if (particles.length < 150) {
      particles.push(createParticle());
    }

    particles = particles.filter(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();

      return p.y < canvas.height + 20;
    });

    if (isActive) {
      animationId = requestAnimationFrame(update);
    }
  }

  window.startConfetti = function() {
    if (!canvas) {
      createCanvas();
    }
    if (!isActive) {
      isActive = true;
      particles = [];
      update();
    }
  };

  window.stopConfetti = function() {
    isActive = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    particles = [];
  };
})();
