// Plik: js/lightlang-player.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { lektor } from './lektor.js';

// --- Konfiguracja Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyD1kuonCrsLNV4ObBiI2jsqdnGx3vaA9_Q",
  authDomain: "projekt-latarnia.firebaseapp.com",
  projectId: "projekt-latarnia",
  storageBucket: "projekt-latarnia.firebasestorage.app",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Inicjalizacja Three.js ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('glcanvas') });
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(0, 0, 6); // Zaczynamy trochę dalej

// --- Oświetlenie ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);
const mainLight = new THREE.PointLight(0xFFD700, 1.0, 20);
mainLight.position.set(0, 3, 4);
scene.add(mainLight);

// --- Scena: Wnętrze latarni ---
const geometry = new THREE.CylinderGeometry(8, 8, 20, 32, 1, true);
const material = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, side: THREE.BackSide });
const cylinder = new THREE.Mesh(geometry, material);
scene.add(cylinder);

// --- Cząsteczki ---
let particleSystem;
function createParticles(style = 'hope', intensity = 1.0) {
    if (particleSystem) scene.remove(particleSystem);
    const count = style === 'chaotic' ? 5000 : 1500;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < positions.length; i++) {
        positions[i] = (Math.random() - 0.5) * 20;
    }
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMaterial = new THREE.PointsMaterial({
        color: style === 'chaotic' ? 0x555555 : 0xFFD700,
        size: style === 'chaotic' ? 0.05 : 0.08,
        transparent: true,
        opacity: 0.5 * intensity
    });
    particleSystem = new THREE.Points(particles, pMaterial);
    scene.add(particleSystem);
}
createParticles('hope', 0.2); // Startowe, spokojne cząsteczki

// --- Efekty (Post-processing) ---
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0, 0, 0);
composer.addPass(bloomPass);
// Prosty shader dla ziarna filmowego
const filmGrainShader = {
    uniforms: { tDiffuse: { value: null }, amount: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv; float random( vec2 co ){ return fract( sin( dot( co.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); } void main() { vec4 color = texture2D( tDiffuse, vUv ); float grain = random( vUv * ( sin( amount * 100.0 ) ) ) * amount; gl_FragColor = vec4( color.rgb - grain, color.a );}`
};
const filmGrainPass = new THREE.ShaderPass(filmGrainShader);
composer.addPass(filmGrainPass);

// --- Zmienne globalne odtwarzacza ---
let activeTextMesh = null;
const fontLoader = new THREE.FontLoader();
let font = null;
let currentFlickerInterval = null;

async function runExperience() {
    document.getElementById("runExperienceBtn").disabled = true;
    try {
        const docRef = doc(db, "lightlang_scripts", "dzien_po_dniu_v1");
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("Nie znaleziono scenariusza 'dzien_po_dniu_v1' w bazie.");
            return;
        }
        
        const scriptActions = docSnap.data().actions || [];

        for (const action of scriptActions) {
            if (activeTextMesh) {
                scene.remove(activeTextMesh);
                activeTextMesh = null;
            }

            switch (action.action) {
                case "showText":
                    const geometry = new THREE.TextGeometry(action.text, { font, size: 0.5, height: 0.05, curveSegments: 12 });
                    geometry.center();
                    const material = new THREE.MeshPhongMaterial({ color: parseInt(action.color.replace("#", "0x")) });
                    activeTextMesh = new THREE.Mesh(geometry, material);
                    scene.add(activeTextMesh);
                    lektor.enqueue(action.text);
                    break;
                case "setEffect":
                    if (action.effect === "bloom") bloomPass.strength = action.intensity;
                    if (action.effect === "filmGrain") filmGrainPass.uniforms.amount.value = action.intensity;
                    if (action.effect === "cameraShake") { /* implementacja drżenia kamery */ }
                    if (action.effect === "all" && action.intensity === 0.0) {
                        bloomPass.strength = 0;
                        filmGrainPass.uniforms.amount.value = 0;
                    }
                    break;
                case "setLight":
                    mainLight.color.set(action.color);
                    mainLight.intensity = action.intensity;
                    if (currentFlickerInterval) clearInterval(currentFlickerInterval);
                    if (action.flicker) {
                        const baseIntensity = action.intensity;
                        currentFlickerInterval = setInterval(() => {
                            mainLight.intensity = baseIntensity * (0.8 + Math.random() * 0.4);
                        }, 100);
                    }
                    break;
                case "cameraMove":
                    new TWEEN.Tween(camera.position)
                        .to({ x: action.to.x || 0, y: action.to.y || 0, z: action.to.z || 5 }, action.speed)
                        .easing(TWEEN.Easing.Quadratic.InOut)
                        .start();
                    break;
                case "setParticles":
                    createParticles(action.style, action.intensity);
                    break;
            }
            if (action.duration) await new Promise(resolve => setTimeout(resolve, action.duration));
        }
    } catch (error) {
        console.error("Błąd krytyczny LightLang:", error);
        document.getElementById("loading").textContent = "Wystąpił błąd krytyczny. Sprawdź konsolę (F12).";
    }
}

function animate(time) {
    requestAnimationFrame(animate);
    TWEEN.update(time);
    if (activeTextMesh) activeTextMesh.rotation.y += 0.003;
    if (particleSystem) particleSystem.rotation.y += 0.0005;
    composer.render();
}

// --- Start ---
fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (loadedFont) => {
    font = loadedFont;
    document.getElementById("loading").style.display = 'none';
    const runBtn = document.getElementById("runExperienceBtn");
    runBtn.disabled = false;
    runBtn.addEventListener("click", runExperience);
    animate();
});

