import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

class App {
    constructor() {
        // Initialize collections first
        this.loadedModels = new Map();
        this.draggableObjects = [];

        this.init();
        this.setupScene();
        this.setupLights();
        this.setupInitialControls(); // Renamed to indicate initial setup
        this.animate();
    }

    init() {
        this.container = document.getElementById('scene-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 3);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setupScene() {
        this.scene.background = new THREE.Color(0xcccccc);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
    }

    setupInitialControls() {
        // Setup orbit controls
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;

        // Setup drag controls with empty array initially
        this.dragControls = new DragControls(this.draggableObjects, this.camera, this.renderer.domElement);
        
        this.setupControlsEventListeners();
    }

    setupControlsEventListeners() {
        this.dragControls.addEventListener('dragstart', () => {
            this.orbitControls.enabled = false;
        });

        this.dragControls.addEventListener('dragend', () => {
            this.orbitControls.enabled = true;
        });
    }

    updateDragControls() {
        // Update draggable objects array
        this.draggableObjects = Array.from(this.loadedModels.values());
        
        // Dispose old drag controls
        if (this.dragControls) {
            this.dragControls.dispose();
        }

        // Create new drag controls with updated objects
        this.dragControls = new DragControls(this.draggableObjects, this.camera, this.renderer.domElement);
        this.setupControlsEventListeners();
    }

    loadModel(url, name) {
        const loader = new GLTFLoader();
        loader.load(
            url, 
            (gltf) => {
                const model = gltf.scene;
                
                // Center the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.sub(center);
                
                this.scene.add(model);
                this.loadedModels.set(name, model);
                
                // Update drag controls with new objects
                this.updateDragControls();

                console.log(`Loaded model: ${name}`);
            },
            (xhr) => {
                console.log(`${name} ${(xhr.loaded / xhr.total * 100)}% loaded`);
            },
            (error) => {
                console.error(`Error loading model ${name}:`, error);
            }
        );
    }

    loadDefaultModels() {
        const models = [
            { url: './assets/kool-mandoline-blade.glb', name: 'blade' },
            { url: './assets/kool-mandoline-frame.glb', name: 'frame' },
            { url: './assets/kool-mandoline-handguard.glb', name: 'handguard' },
            { url: './assets/kool-mandoline-handletpe.glb', name: 'handle' }
        ];

        models.forEach(model => {
            this.loadModel(model.url, model.name);
        });
    }

    animate() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.orbitControls.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }
}

// Create instance of the application
const app = new App();
app.loadDefaultModels();

// Export the app instance if needed
export default app;
