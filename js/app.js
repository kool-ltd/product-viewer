import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

class App {
    constructor() {
        this.loadedModels = new Map();
        this.draggableObjects = [];
        this.isARMode = false;

        // Create a loading overlay on the page
        this.createLoadingOverlay();

        // Setup the loading manager. When all assets are loaded, call initAfterPreload.
        this.loadingManager = new THREE.LoadingManager(() => {
            // All assets have been loaded – hide the loading overlay and initialize the app.
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
            this.initAfterPreload();
        });
        this.loadingManager.onProgress = (url, loaded, total) => {
            const loadingText = document.getElementById('loading-text');
            if (loadingText) {
                loadingText.textContent = `loading ${loaded} of ${total}`;
            }
        };

        // Create loaders with the loading manager
        this.gltfLoader = new GLTFLoader(this.loadingManager);
        this.rgbeLoader = new RGBELoader(this.loadingManager);

        // Start preloading the assets
        this.preloadAssets();
    }

    // -------------------------------------------------------------------------
    // Preload Setup
    // -------------------------------------------------------------------------
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        // Use the same light gray background as the scene.
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = '#cccccc';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '9999';
        overlay.innerHTML = `
            <div id="loading-spinner" style="
                border: 11px solid #fd00024; 
                border-top: 11px solid #f3f3f3; 
                border-radius: 50%; 
                width: 84px; 
                height: 84px; 
                animation: spin 2s linear infinite;
            "></div>
            <div id="loading-text" style="color: #333; margin-top: 20px; font-size: 14px; font-family: sans-serif;">loading...</div>
        `;
        document.body.appendChild(overlay);

        // Inject CSS keyframes for the spinner animation.
        const style = document.createElement('style');
        style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        `;
        document.head.appendChild(style);
    }

    preloadAssets() {
        // Preload the HDR environment map.
        this.rgbeLoader.load('assets/brown_photostudio_02_4k.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.preloadedEnvTexture = texture;
        });

        // Preload GLB models.
        const models = [
            { url: 'assets/kool-mandoline-blade.glb', name: 'blade' },
            { url: 'assets/kool-mandoline-frame.glb', name: 'frame' },
            { url: 'assets/kool-mandoline-handguard.glb', name: 'handguard' },
            { url: 'assets/kool-mandoline-handletpe.glb', name: 'handle' }
        ];

        this.preloadedModels = {};
        models.forEach(model => {
            this.gltfLoader.load(model.url, (gltf) => {
                this.preloadedModels[model.name] = gltf.scene;
            });
        });
    }

    initAfterPreload() {
        // Call all the initialization functions after preloading is done.
        this.init();
        this.setupScene();
        this.setupLights();
        this.setupInitialControls();
        this.setupARButton();
        this.setupFileUpload();
        this.loadPreloadedModels();
        this.animate();
    }

    // -------------------------------------------------------------------------
    // App Initial Setup: Scene, Camera, Renderer
    // -------------------------------------------------------------------------
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

        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    // -------------------------------------------------------------------------
    // Scene, Lights, and Environment
    // -------------------------------------------------------------------------
    setupScene() {
        this.scene.background = new THREE.Color(0xcccccc);

        // Use the preloaded HDR environment map if available.
        if (this.preloadedEnvTexture) {
            this.scene.environment = this.preloadedEnvTexture;
            this.renderer.physicallyCorrectLights = true;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 0.7;
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        } else {
            // Fallback: load HDR normally
            const rgbeLoader = new RGBELoader();
            rgbeLoader.load('assets/brown_photostudio_02_4k.hdr', (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                this.scene.environment = texture;
                this.renderer.physicallyCorrectLights = true;
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                this.renderer.toneMappingExposure = 0.7;
                this.renderer.outputEncoding = THREE.sRGBEncoding;
            });
        }
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
    }

    // -------------------------------------------------------------------------
    // Controls and AR Setup
    // -------------------------------------------------------------------------
    setupInitialControls() {
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;

        this.dragControls = new DragControls(this.draggableObjects, this.camera, this.renderer.domElement);
        this.setupControlsEventListeners();

        // Add touch interaction for AR mode.
        this.renderer.domElement.addEventListener('touchstart', (event) => {
            if (!this.isARMode) return;
            
            event.preventDefault();
            const touch = event.touches[0];
            const mouse = new THREE.Vector2();
            mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.camera);
            const intersects = raycaster.intersectObjects(this.draggableObjects, true);
            if (intersects.length > 0) {
                const selectedObject = intersects[0].object;
                let targetObject = selectedObject;
                // Find the root object
                while (targetObject.parent && targetObject.parent !== this.scene) {
                    targetObject = targetObject.parent;
                }
                this.selectedObject = targetObject;
                this.initialTouchX = touch.clientX;
                this.initialTouchY = touch.clientY;
                this.initialObjectPosition = targetObject.position.clone();
            }
        });

        this.renderer.domElement.addEventListener('touchmove', (event) => {
            if (!this.isARMode || !this.selectedObject) return;
            
            event.preventDefault();
            const touch = event.touches[0];
            const deltaX = (touch.clientX - this.initialTouchX) * 0.01;
            const deltaY = (touch.clientY - this.initialTouchY) * 0.01;
            const cameraRight = new THREE.Vector3();
            const cameraUp = new THREE.Vector3();
            this.camera.getWorldDirection(cameraRight);
            cameraRight.cross(this.camera.up).normalize();
            cameraUp.copy(this.camera.up);
            this.selectedObject.position.copy(this.initialObjectPosition);
            this.selectedObject.position.add(cameraRight.multiplyScalar(-deltaX));
            this.selectedObject.position.add(cameraUp.multiplyScalar(-deltaY));
        });

        this.renderer.domElement.addEventListener('touchend', () => {
            if (!this.isARMode) return;
            this.selectedObject = null;
        });
    }

    setupControlsEventListeners() {
        this.dragControls.addEventListener('dragstart', () => {
            this.orbitControls.enabled = false;
        });
        this.dragControls.addEventListener('dragend', () => {
            this.orbitControls.enabled = true;
        });
    }

    setupARButton() {
        if ('xr' in navigator) {
            const arButton = ARButton.createButton(this.renderer, {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.body }
            });
            document.body.appendChild(arButton);
            // Remove background when entering AR.
            this.renderer.xr.addEventListener('sessionstart', () => {
                this.isARMode = true;
                this.scene.background = null;
            });
            // Restore background when exiting AR.
            this.renderer.xr.addEventListener('sessionend', () => {
                this.isARMode = false;
                this.scene.background = new THREE.Color(0xcccccc);
            });
        }
    }

    // -------------------------------------------------------------------------
    // File Upload and Model Loading (for user-provided models)
    // -------------------------------------------------------------------------
    setupFileUpload() {
        const uploadContainer = document.createElement('div');
        uploadContainer.style.position = 'fixed';
        uploadContainer.style.top = '10px';
        uploadContainer.style.left = '10px';
        uploadContainer.style.zIndex = '1000';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.glb,.gltf';
        fileInput.style.display = 'none';
        fileInput.multiple = true;

        const uploadButton = document.createElement('button');
        uploadButton.textContent = 'Upload Model';
        uploadButton.style.padding = '10px';
        uploadButton.style.cursor = 'pointer';
        uploadButton.onclick = () => fileInput.click();

        fileInput.onchange = (event) => {
            this.clearExistingModels();
            const files = event.target.files;
            for (let file of files) {
                const url = URL.createObjectURL(file);
                const name = file.name.replace('.glb', '').replace('.gltf', '');
                this.loadModel(url, name);
            }
        };

        uploadContainer.appendChild(uploadButton);
        uploadContainer.appendChild(fileInput);
        document.body.appendChild(uploadContainer);
    }

    clearExistingModels() {
        this.loadedModels.forEach(model => {
            this.scene.remove(model);
        });
        this.loadedModels.clear();
        this.draggableObjects.length = 0;
        this.updateDragControls();
    }

    loadModel(url, name) {
        const loader = new GLTFLoader();
        loader.load(
            url, 
            (gltf) => {
                const model = gltf.scene;
                model.userData.isDraggable = true;
                this.draggableObjects.push(model);
                this.scene.add(model);
                this.loadedModels.set(name, model);
                this.updateDragControls();
                this.fitCameraToScene();
                console.log(`Loaded model: ${name}`);
            },
            (xhr) => {
                console.log(`${name} ${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
            },
            (error) => {
                console.error(`Error loading model ${name}:`, error);
            }
        );
    }

    updateDragControls() {
        const draggableObjects = Array.from(this.loadedModels.values());
        if (this.dragControls) {
            this.dragControls.dispose();
        }
        this.dragControls = new DragControls(draggableObjects, this.camera, this.renderer.domElement);
        this.setupControlsEventListeners();
    }

    fitCameraToScene() {
        const box = new THREE.Box3().setFromObject(this.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.tan(fov / 2));
        cameraZ *= 1.5;
        this.camera.position.set(0, 0, cameraZ);
        this.orbitControls.target.copy(center);
        this.camera.updateProjectionMatrix();
        this.orbitControls.update();
    }

    // -------------------------------------------------------------------------
    // Load Preloaded Models into the Scene
    // -------------------------------------------------------------------------
    loadPreloadedModels() {
        for (const [name, model] of Object.entries(this.preloadedModels)) {
            // Clone the model so that each instance is unique.
            const modelClone = model.clone();
            modelClone.userData.isDraggable = true;
            this.draggableObjects.push(modelClone);
            this.scene.add(modelClone);
            this.loadedModels.set(name, modelClone);
        }
        this.updateDragControls();
        this.fitCameraToScene();
    }

    // This method is kept for dynamic loading if needed.
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

    // -------------------------------------------------------------------------
    // Animation Loop
    // -------------------------------------------------------------------------
    animate() {
        this.renderer.setAnimationLoop(() => {
            if (this.isARMode) {
                this.renderer.render(this.scene, this.camera);
            } else {
                this.orbitControls.update();
                this.renderer.render(this.scene, this.camera);
            }
        });
    }
}

const app = new App();
export default app;
