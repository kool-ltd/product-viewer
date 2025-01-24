import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

class App {
    constructor() {
        this.init();
        this.setupScene();
        this.setupLights();
        this.setupControls();
        this.loadEnvironment();
        this.setupEventListeners();
        this.animate();

        // Store loaded models
        this.loadedModels = new Map();
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
        this.camera.position.set(0, 1.6, 3);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.container.appendChild(this.renderer.domElement);

        // Add VR and AR buttons
        document.body.appendChild(VRButton.createButton(this.renderer));
        document.body.appendChild(ARButton.createButton(this.renderer));
    }

    setupScene() {
        this.scene.background = new THREE.Color(0xffffff);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
    }

    setupControls() {
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;

        this.dragControls = new DragControls([], this.camera, this.renderer.domElement);
        
        this.dragControls.addEventListener('dragstart', () => {
            this.orbitControls.enabled = false;
        });

        this.dragControls.addEventListener('dragend', () => {
            this.orbitControls.enabled = true;
        });

        this.dragControls.addEventListener('drag', (event) => {
            const object = event.object;
            if (object.userData.originalScale) {
                object.scale.copy(object.userData.originalScale);
            }
        });
    }

    async loadEnvironment() {
        const rgbeLoader = new RGBELoader();
        try {
            const envMap = await rgbeLoader.loadAsync('./assets/brown_photostudio_02_4k.hdr');
            this.scene.environment = envMap;
            this.scene.background = envMap;
        } catch (error) {
            console.error('Error loading environment map:', error);
        }
    }

    async loadModel(url, name) {
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync(url);
            const model = gltf.scene;
            
            // Store original scale
            model.userData.originalScale = model.scale.clone();
            
            // Add to scene and store reference
            this.scene.add(model);
            this.loadedModels.set(name, model);
            
            // Update drag controls
            this.dragControls.dispose();
            this.dragControls = new DragControls(
                Array.from(this.loadedModels.values()),
                this.camera,
                this.renderer.domElement
            );
            this.setupControls();

            return model;
        } catch (error) {
            console.error('Error loading model:', error);
        }
    }

    async loadDefaultModels() {
        const models = [
            { url: './assets/kool-mandoline-blade.glb', name: 'blade' },
            { url: './assets/kool-mandoline-frame.glb', name: 'frame' },
            { url: './assets/kool-mandoline-handguard.glb', name: 'handguard' },
            { url: './assets/kool-mandoline-handletpe.glb', name: 'handle' }
        ];

        for (const model of models) {
            await this.loadModel(model.url, model.name);
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', this.onWindowResize.bind(this));

        const fileInput = document.getElementById('part-upload');
        fileInput.addEventListener('change', (event) => {
            this.handleFileUpload(event.target.files);
        });
    }

    async handleFileUpload(files) {
        // Clear existing models
        this.loadedModels.forEach(model => {
            this.scene.remove(model);
        });
        this.loadedModels.clear();

        // Load new models
        for (const file of files) {
            const url = URL.createObjectURL(file);
            await this.loadModel(url, file.name);
            URL.revokeObjectURL(url);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        this.renderer.setAnimationLoop(() => {
            this.orbitControls.update();
            this.renderer.render(this.scene, this.camera);
        });
    }
}

// Start the application
const app = new App();
// Load default models
app.loadDefaultModels();
