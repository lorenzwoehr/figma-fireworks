"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 240, height: 160 });
// Track node deletion count and limit concurrent animations
let deletionCount = 0;
const MAX_CONCURRENT_EXPLOSIONS = 3;
const STAGGER_DELAY = 75;
const explosionQueue = [];
// Initialize plugin
function initializePlugin() {
    return __awaiter(this, void 0, void 0, function* () {
        yield figma.loadAllPagesAsync();
        // Track nodes and their bounds
        const nodeCache = new Map();
        figma.on("selectionchange", () => {
            const currentSelection = figma.currentPage.selection;
            currentSelection.forEach((node) => {
                let bounds = null;
                if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
                    bounds = node.absoluteBoundingBox;
                }
                else if ("x" in node &&
                    "y" in node &&
                    "width" in node &&
                    "height" in node) {
                    bounds = {
                        x: node.x,
                        y: node.y,
                        width: node.width,
                        height: node.height,
                    };
                }
                if (bounds) {
                    nodeCache.set(node.id, bounds);
                }
            });
        });
        figma.on("documentchange", (event) => {
            for (const change of event.documentChanges) {
                if (change.type === "DELETE") {
                    const bounds = nodeCache.get(change.id);
                    if (bounds) {
                        // Queue the explosion instead of creating it immediately
                        queueExplosion(() => createExplosionEffect(bounds));
                        nodeCache.delete(change.id);
                    }
                    figma.root.setPluginData(change.id, "");
                }
            }
        });
    });
}
// Queue manager for explosions
function queueExplosion(explosionFn) {
    const timestamp = Date.now();
    if (deletionCount < MAX_CONCURRENT_EXPLOSIONS) {
        deletionCount++;
        // Add stagger delay based on current deletion count
        setTimeout(() => {
            explosionFn();
            // Schedule queue processing after animation
            setTimeout(() => {
                deletionCount--;
                processQueue();
            }, 800); // Match animation duration
        }, deletionCount * STAGGER_DELAY);
    }
    else {
        explosionQueue.push({ createExplosion: explosionFn, timestamp });
    }
}
// Process queued explosions
function processQueue() {
    if (explosionQueue.length > 0 && deletionCount < MAX_CONCURRENT_EXPLOSIONS) {
        const nextExplosion = explosionQueue.shift();
        if (nextExplosion) {
            queueExplosion(nextExplosion.createExplosion);
        }
    }
}
// Start the plugin
initializePlugin().catch(console.error);
// Smoothly interpolate scale factor based on node size
function calculateScaleFactor(nodeSize) {
    // Use a logistic growth curve with custom parameters
    // This creates an S-shaped curve that smoothly transitions between size ranges
    const k = 0.005; // Steepness of the curve
    const midpoint = 800; // Size at which we want middle scaling
    const minScale = 0.15; // Minimum scale factor
    const maxScale = 1.5; // Maximum scale factor
    // Logistic function: scale = minScale + (maxScale - minScale) / (1 + e^(-k * (size - midpoint)))
    const baseScale = minScale +
        (maxScale - minScale) / (1 + Math.exp(-k * (nodeSize - midpoint)));
    // Apply logarithmic dampening for very large sizes
    const dampening = nodeSize > midpoint ? 1 - Math.log10(nodeSize / midpoint) * 0.1 : 1;
    return baseScale * dampening;
}
function calculateExplosionParameters(bounds) {
    const zoom = figma.viewport.zoom;
    // Calculate the diagonal size of the node
    const nodeSize = Math.sqrt(bounds.width * bounds.height);
    // Get base scale factor using smooth scaling function
    const baseScaleFactor = calculateScaleFactor(nodeSize);
    const particleSize = 4 / zoom;
    const particleCount = Math.max(5, Math.floor(25 * Math.sqrt(baseScaleFactor)));
    // Smooth curve for animation duration
    const animationDuration = Math.floor(400 + 400 * (1 - Math.exp(-baseScaleFactor)));
    // Distance scaling
    const distanceScale = nodeSize / Math.min(1, lerp(0.3, 1, zoom)) / 2;
    /* Some logging
    console.log(
      `Node size: ${nodeSize.toFixed(2)}px, ` +
        `Base scale: ${baseScaleFactor.toFixed(2)}, ` +
        `Particle size: ${particleSize.toFixed(2)}px, ` +
        `Particle count: ${particleCount}, ` +
        `Animation duration: ${animationDuration}ms, ` +
        `Max distance: ${distanceScale.toFixed(2)}px`
    ); */
    return {
        particleSize,
        particleCount,
        animationDuration,
        maxDistance: distanceScale, // Cap maximum distance
    };
}
function createExplosionEffect(bounds) {
    // Get explosion parameters
    const { particleSize, particleCount, animationDuration, maxDistance } = calculateExplosionParameters(bounds);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    // Create or get the explosions group
    let explosionsGroup = figma.currentPage.findChild((n) => n.name === "🎆 Explosions");
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
    const explosionGroup = figma.createFrame();
    explosionGroup.name = "💥 Explosion";
    explosionGroup.locked = true;
    explosionGroup.fills = [];
    explosionGroup.clipsContent = false;
    explosionGroup.layoutMode = "NONE";
    const explosionSize = Math.max(1, maxDistance * 2); // Ensure minimum size of 1 to avoid errors
    explosionGroup.resize(explosionSize, explosionSize);
    explosionGroup.x = centerX - explosionSize / 2;
    explosionGroup.y = centerY - explosionSize / 2;
    explosionsGroup.appendChild(explosionGroup);
    const particles = [];
    const particleAnimations = [];
    const palettes = [
        ["#23CB71", "#1FB864", "#1AA557", "#16924A", "#127F3D"],
        ["#4C4AFC", "#3E3DD9", "#3030B6", "#232393", "#161670"],
        ["#FF00E4", "#E600CD", "#CC00B6", "#B3009F", "#990088"],
        ["#FE7136", "#FE5F1D", "#FE4D04", "#E54403", "#CC3C03"],
    ];
    const selectedPalette = palettes[Math.floor(Math.random() * palettes.length)];
    // Create particles with zoom-adjusted sizes
    for (let i = 0; i < particleCount; i++) {
        const particle = figma.createEllipse();
        particles.push(particle);
        explosionGroup.appendChild(particle);
        const particleStartX = (explosionSize - particleSize) / 2;
        const particleStartY = (explosionSize - particleSize) / 2;
        particle.x = particleStartX;
        particle.y = particleStartY;
        particle.resize(particleSize, particleSize);
        particle.fills = [
            {
                type: "SOLID",
                color: hexToRGB(selectedPalette[Math.floor(Math.random() * selectedPalette.length)]),
            },
        ];
        const angle = Math.random() * Math.PI * 2;
        const minDistanceFactor = 0.85;
        const distance = (minDistanceFactor + (1 - minDistanceFactor) * Math.random()) *
            maxDistance;
        const targetX = particleStartX + Math.cos(angle) * distance;
        const targetY = particleStartY + Math.sin(angle) * distance;
        const animationPromise = (() => __awaiter(this, void 0, void 0, function* () {
            const steps = 12;
            const fadeStartProgress = 0.7;
            for (let step = 0; step <= steps; step++) {
                const progress = step / steps;
                const easeProgress = easeOutCubic(progress);
                particle.x = lerp(particleStartX, targetX, easeProgress);
                particle.y = lerp(particleStartY, targetY, easeProgress);
                if (progress >= fadeStartProgress) {
                    const fadeProgress = (progress - fadeStartProgress) / (1 - fadeStartProgress);
                    particle.opacity = 1 - fadeProgress;
                }
                else {
                    particle.opacity = 1;
                }
                yield new Promise((resolve) => setTimeout(resolve, animationDuration / steps));
            }
            particle.opacity = 0;
        }))();
        particleAnimations.push(animationPromise);
    }
    Promise.all(particleAnimations)
        .then(() => {
        particles.forEach((particle) => {
            particle.opacity = 0;
        });
        return new Promise((resolve) => setTimeout(resolve, 50));
    })
        .then(() => {
        if (explosionGroup && explosionGroup.parent) {
            explosionGroup.remove();
        }
        if (explosionsGroup &&
            explosionsGroup.parent &&
            explosionsGroup.children.length === 0) {
            explosionsGroup.remove();
        }
    });
}
function hexToRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
}
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}
function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
}
