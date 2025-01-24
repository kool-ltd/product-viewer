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
        this.controller = null;
        this.reticle = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.modelPlaced = false;

        this.init();
        this.setupScene();
        this.setupLights();
        this.setupInitialControls();
        this.setupFileUpload();
        this.setupARButton();
        this.animate();
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
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

    setupScene() {
        this.scene.background = new THREE.Color(0xcccccc);

        const rgbeLoader = new RGBELoader();
        rgbeLoader.load('https://raw.githubusercontent.com/kool-ltd/product-viewer/main/assets/brown_photostudio_02_4k.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.environment = texture;
            
            this.renderer.physicallyCorrectLights = true;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 0.7;
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        });

        // Create reticle
        const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
        const material = new THREE.MeshBasicMaterial();
        this.reticle = new THREE.Mesh(geometry, material);
        this.reticle.visible = false;
        this.reticle.matrixAutoUpdate = false;
        this.scene.add(this.reticle);
    }

setupARButton() {
    if ('xr' in navigator) {
        const arButton = ARButton.createButton(this.renderer, {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: document.body }
        });
        document.body.appendChild(arButton);

        this.renderer.xr.addEventListener('sessionstart', () => {
            this.isARMode = true;
            this.scene.background = null;
            this.modelPlaced = false;
            // Hide all models when entering AR
            this.loadedModels.forEach(model => {
                model.visible = false;
            });
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            this.isARMode = false;
            this.scene.background = new THREE.Color(0xcccccc);
            this.modelPlaced = false;
            // Show all models when exiting AR
            this.loadedModels.forEach(model => {
                model.visible = true;
            });
        });

        // Add touch event listener for AR placement
        this.renderer.domElement.addEventListener('touchstart', (event) => {
            if (this.isARMode && this.reticle.visible && !this.modelPlaced) {
                event.preventDefault();
                
                // Place all models at the reticle's position
                const matrix = new THREE.Matrix4();
                matrix.fromArray(this.reticle.matrix.elements);
                
                this.loadedModels.forEach(model => {
                    model.position.setFromMatrixPosition(matrix);
                    model.visible = true;
                });
                
                this.modelPlaced = true;
                this.reticle.visible = false;
            }
        });
    }
}

    async initializeARHitTesting() {
        const session = this.renderer.xr.getSession();
        const viewerSpace = await session.requestReferenceSpace('viewer');
        const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
        return hitTestSource;
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);
    }

    setupInitialControls() {
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;

        this.dragControls = new DragControls(this.draggableObjects, this.camera, this.renderer.domElement);
        this.setupControlsEventListeners();

        // Add touch interaction for AR mode
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
            if (!this.isARMode) {
                this.orbitControls.enabled = false;
            }
        });

        this.dragControls.addEventListener('dragend', () => {
            if (!this.isARMode) {
                this.orbitControls.enabled = true;
            }
        });
    }

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
                
                // Set initial visibility based on AR mode
                model.visible = !this.isARMode;
                
                this.scene.add(model);
                this.loadedModels.set(name, model);
                
                this.updateDragControls();
                this.fitCameraToScene();
    
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
        this.renderer.setAnimationLoop((timestamp, frame) => {
            if (this.isARMode && frame) {
                if (!this.hitTestSourceRequested) {
                    this.initializeARHitTesting().then(source => {
                        this.hitTestSource = source;
                    });
                    this.hitTestSourceRequested = true;
                }
    
                if (this.hitTestSource && !this.modelPlaced) {
                    const referenceSpace = this.renderer.xr.getReferenceSpace();
                    const hitTestResults = frame.getHitTestResults(this.hitTestSource);
    
                    if (hitTestResults.length > 0) {
                        const hit = hitTestResults[0];
                        const hitPose = hit.getPose(referenceSpace);
                        
                        this.reticle.visible = true;
                        this.reticle.matrix.fromArray(hitPose.transform.matrix);
                    } else {
                        this.reticle.visible = false;
                    }
                }
            }
    
            if (this.isARMode) {
                this.renderer.render(this.scene, this.camera);
            } else {
                this.orbitControls.update();
                this.renderer.render(this.scene, this.camera);
            }
        });
    }

const app = new App();
app.loadDefaultModels();

export default app;
