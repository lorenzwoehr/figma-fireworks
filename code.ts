figma.showUI(__html__, { width: 240, height: 160 });

// Track node deletion count for staggering
let deletionCount = 0;

// Initialize plugin
async function initializePlugin() {
  await figma.loadAllPagesAsync();

  // Track nodes and their bounds
  const nodeCache = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();

  figma.on("selectionchange", () => {
    const currentSelection = figma.currentPage.selection;
    currentSelection.forEach((node: SceneNode) => {
      // Handle both Figma and FigJam nodes
      let bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      } | null = null;

      // Check if it's a DefaultShapeMixin (Figma) node
      if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
        bounds = node.absoluteBoundingBox;
      }
      // Check if it's a FrameNode, ShapeWithTextNode, StickyNode, or other FigJam node
      else if (
        "x" in node &&
        "y" in node &&
        "width" in node &&
        "height" in node
      ) {
        bounds = {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        };
      }

      if (bounds) {
        nodeCache.set(node.id, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });
      }
    });
  });

  figma.on("documentchange", (event) => {
    for (const change of event.documentChanges) {
      if (change.type === "DELETE") {
        const bounds = nodeCache.get(change.id);
        if (bounds) {
          // Add delay based on deletion count
          setTimeout(() => {
            createExplosionEffect(bounds);
          }, deletionCount * 100);
          deletionCount++;

          // Reset counter after a short while
          setTimeout(() => {
            deletionCount = 0;
          }, 1000);

          nodeCache.delete(change.id);
        }
        figma.root.setPluginData(change.id, "");
      }
    }
  });
}

// Start the plugin
initializePlugin().catch(console.error);

function createExplosionEffect(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  // Calculate size-based parameters
  const nodeSize = Math.sqrt(bounds.width * bounds.height);
  const BASE_SIZE = 100;
  const scaleFactor = Math.max(0.5, Math.min(2, nodeSize / BASE_SIZE));
  const PARTICLE_SIZE = Math.max(4, Math.min(32, Math.floor(2 * scaleFactor)));
  const PARTICLE_COUNT = Math.floor(30 * scaleFactor);
  const ANIMATION_DURATION = Math.floor(800 * Math.sqrt(scaleFactor));
  const MAX_DISTANCE = nodeSize * 0.5;

  // Calculate the center point of the deleted node
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  // Create parent explosions group at the start if it doesn't exist
  let explosionsGroup: FrameNode = figma.currentPage.findChild(
    (n) => n.name === "🎆 Explosions"
  ) as FrameNode;
  if (!explosionsGroup) {
    explosionsGroup = figma.createFrame();
    explosionsGroup.name = "🎆 Explosions";
    explosionsGroup.locked = true;
    explosionsGroup.expanded = false;
    explosionsGroup.fills = [];
    explosionsGroup.clipsContent = false;
    explosionsGroup.layoutMode = "NONE";
    figma.currentPage.appendChild(explosionsGroup);
  }

  // Create a group for this specific explosion
  const explosionGroup: FrameNode = figma.createFrame();
  explosionGroup.name = "💥 Explosion";
  explosionGroup.locked = true;
  explosionGroup.fills = [];
  explosionGroup.clipsContent = false;
  explosionGroup.layoutMode = "NONE";

  // Set the explosion group's size and position
  const explosionSize = MAX_DISTANCE * 2;
  explosionGroup.resize(explosionSize, explosionSize);
  explosionGroup.x = centerX - explosionSize / 2;
  explosionGroup.y = centerY - explosionSize / 2;

  // Add to main explosions group
  explosionsGroup.appendChild(explosionGroup);

  // Create all particles before starting animations
  const particles: EllipseNode[] = [];
  const particleAnimations: Promise<void>[] = [];

  // Figma-themed color palettes (derived from brand colors)
  const palettes = [
    // Green palette (derived from #23CB71)
    ["#23CB71", "#1FB864", "#1AA557", "#16924A", "#127F3D"],
    // Blue palette (derived from #4C4AFC)
    ["#4C4AFC", "#3E3DD9", "#3030B6", "#232393", "#161670"],
    // Magenta palette (derived from #FF00E4)
    ["#FF00E4", "#E600CD", "#CC00B6", "#B3009F", "#990088"],
    // Orange palette (derived from #FE7136)
    ["#FE7136", "#FE5F1D", "#FE4D04", "#E54403", "#CC3C03"],
  ];
  // Select a single palette for this explosion
  const selectedPalette = palettes[Math.floor(Math.random() * palettes.length)];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const particle = figma.createEllipse();
    particles.push(particle);
    explosionGroup.appendChild(particle);

    // Position particle at the center of the explosion group
    const particleStartX = (explosionSize - PARTICLE_SIZE) / 2;
    const particleStartY = (explosionSize - PARTICLE_SIZE) / 2;
    particle.x = particleStartX;
    particle.y = particleStartY;
    particle.resize(PARTICLE_SIZE, PARTICLE_SIZE);

    // Random color from the selected palette
    particle.fills = [
      {
        type: "SOLID",
        color: hexToRGB(
          selectedPalette[Math.floor(Math.random() * selectedPalette.length)]
        ),
      },
    ];

    // Calculate random trajectory
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * (MAX_DISTANCE - 50) + 50;
    const targetX = particleStartX + Math.cos(angle) * distance;
    const targetY = particleStartY + Math.sin(angle) * distance;

    // Create animation promise
    const animationPromise = (async () => {
      const steps = 20;
      const fadeStartProgress = 0.7; // Start fading earlier

      for (let step = 0; step <= steps; step++) {
        const progress = step / steps;
        const easeProgress = easeOutCubic(progress);

        particle.x = lerp(particleStartX, targetX, easeProgress);
        particle.y = lerp(particleStartY, targetY, easeProgress);

        // Fade out gradually from fadeStartProgress to 1
        if (progress >= fadeStartProgress) {
          const fadeProgress =
            (progress - fadeStartProgress) / (1 - fadeStartProgress);
          particle.opacity = 1 - fadeProgress;
        } else {
          particle.opacity = 1;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, ANIMATION_DURATION / steps)
        );
      }

      // Ensure particle is fully invisible at the end
      particle.opacity = 0;
    })();

    particleAnimations.push(animationPromise);
  }

  // Wait for all animations to complete, then remove the explosion group
  Promise.all(particleAnimations)
    .then(() => {
      // Force opacity to 0 for all particles one last time
      particles.forEach((particle) => {
        particle.opacity = 0;
      });

      // Small delay to ensure opacity update is applied
      return new Promise((resolve) => setTimeout(resolve, 50));
    })
    .then(() => {
      // Remove the explosion group
      if (explosionGroup && explosionGroup.parent) {
        explosionGroup.remove();
      }

      // Check and remove the main explosions group if it exists and is empty
      if (
        explosionsGroup &&
        explosionsGroup.parent &&
        explosionsGroup.children.length === 0
      ) {
        explosionsGroup.remove();
      }
    });
}

// Utility functions
function hexToRGB(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

function lerp(start: number, end: number, t: number) {
  return start * (1 - t) + end * t;
}

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
