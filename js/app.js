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
        this.selectedObject = null;
        this.controllers = [];
        this.controllerGrips = [];

        this.init();
        this.setupScene();
        this.setupLights();
        this.setupInitialControls();
        this.setupFileUpload();
        this.setupARButton();
        this.setupARTouchControls();
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
    }

    setupARButton() {
        if ('xr' in navigator) {
            const arButton = ARButton.createButton(this.renderer, {
                requiredFeatures: ['hit-test'],
                optionalFeatures: ['dom-overlay'],
                domOverlay: { root: document.body }
            });
            document.body.appendChild(arButton);

            // Setup controllers
            this.setupControllers();

            // Hit-test indicator (make it more visible)
            const geometry = new THREE.RingGeometry(0.15, 0.2, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x00ff00,  // Bright green color
                opacity: 0.8,
                transparent: true,
                side: THREE.DoubleSide
            });
            this.reticle = new THREE.Mesh(geometry, material);
            this.reticle.matrixAutoUpdate = false;
            this.reticle.visible = false;
            this.reticle.rotateX(-Math.PI / 2);
            this.scene.add(this.reticle);

            // Make reticle always face the camera
            this.reticle.renderOrder = 1;  // Ensure it renders on top
            
            // Session start/end handlers
            this.renderer.xr.addEventListener('sessionstart', () => {
                this.isARMode = true;
                this.scene.background = null;
                
                // Don't hide models immediately in AR mode
                this.loadedModels.forEach(model => {
                    model.position.set(0, 0, -2); // Position in front of the user
                    model.visible = true;
                });
            });

            this.renderer.xr.addEventListener('sessionend', () => {
                this.isARMode = false;
                this.scene.background = new THREE.Color(0xcccccc);
                this.loadedModels.forEach(model => {
                    model.visible = true;
                });
            });
        }
    }

    setupControllers() {
        // Controller 1
        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.addEventListener('selectstart', () => this.onControllerSelectStart(this.controller1));
        this.controller1.addEventListener('selectend', () => this.onControllerSelectEnd(this.controller1));
        this.scene.add(this.controller1);

        // Controller 2
        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.addEventListener('selectstart', () => this.onControllerSelectStart(this.controller2));
        this.controller2.addEventListener('selectend', () => this.onControllerSelectEnd(this.controller2));
        this.scene.add(this.controller2);

        // Controller visual indicators
        const controllerGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);

        const controllerMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff
        });

        const controllerLine = new THREE.Line(controllerGeometry, controllerMaterial);
        controllerLine.scale.z = 5;

        this.controller1.add(controllerLine.clone());
        this.controller2.add(controllerLine.clone());
    }

    onControllerSelectStart(controller) {
        if (this.reticle.visible) {
            this.loadedModels.forEach(model => {
                model.position.setFromMatrixPosition(this.reticle.matrix);
                model.visible = true;
            });
        }

        // Raycasting for object manipulation
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(controller.matrixWorld);

        const raycaster = new THREE.Raycaster();
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        const intersects = raycaster.intersectObjects(Array.from(this.loadedModels.values()), true);
        
        if (intersects.length > 0) {
            this.selectedObject = intersects[0].object;
            controller.userData.selectedObject = this.selectedObject;
            controller.userData.initialPosition = this.selectedObject.position.clone();
            controller.userData.initialControllerPosition = controller.position.clone();
        }
    }

    onControllerSelectEnd(controller) {
        if (controller.userData.selectedObject) {
            controller.userData.selectedObject = null;
        }
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
    }

    setupControlsEventListeners() {
        this.dragControls.addEventListener('dragstart', () => {
            this.orbitControls.enabled = false;
        });

        this.dragControls.addEventListener('dragend', () => {
            this.orbitControls.enabled = true;
        });
    }

    setupARTouchControls() {
        let startX, startY;
        let isRotating = false;
        let isMoving = false;

        this.renderer.domElement.addEventListener('touchstart', (event) => {
            if (!this.isARMode) return;
            
            if (event.touches.length === 1) {
                startX = event.touches[0].pageX;
                startY = event.touches[0].pageY;
                isMoving = true;
            } else if (event.touches.length === 2) {
                isRotating = true;
                isMoving = false;
            }
        });

        this.renderer.domElement.addEventListener('touchmove', (event) => {
            if (!this.isARMode) return;
            
            if (isMoving && event.touches.length === 1) {
                const deltaX = (event.touches[0].pageX - startX) * 0.01;
                const deltaY = (event.touches[0].pageY - startY) * 0.01;

                this.loadedModels.forEach(model => {
                    if (model.visible) {
                        model.position.x += deltaX;
                        model.position.z += deltaY;
                    }
                });

                startX = event.touches[0].pageX;
                startY = event.touches[0].pageY;
            } else if (isRotating && event.touches.length === 2) {
                const touch1 = event.touches[0];
                const touch2 = event.touches[1];
                const rotation = Math.atan2(
                    touch2.pageY - touch1.pageY,
                    touch2.pageX - touch1.pageX
                );

                this.loadedModels.forEach(model => {
                    if (model.visible) {
                        model.rotation.y = rotation;
                    }
                });
            }
        });

        this.renderer.domElement.addEventListener('touchend', () => {
            isMoving = false;
            isRotating = false;
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
                
                // Scale the model up significantly for VR/AR
                model.scale.set(5, 5, 5); // Adjust this value as needed (try values between 1-10)
                
                // Position the model at a reasonable height in VR/AR
                model.position.set(0, 0, -2); // Adjust these values as needed
                
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
        let hitTestSourceRequested = false;
        let hitTestSource = null;

        this.renderer.setAnimationLoop((timestamp, frame) => {
            if (this.isARMode && frame) {
                if (!hitTestSourceRequested) {
                    const session = frame.session;
                    session.requestReferenceSpace('viewer').then((referenceSpace) => {
                        session.requestHitTestSource({ space: referenceSpace })
                            .then((source) => {
                                hitTestSource = source;
                            });
                    });

                    session.requestReferenceSpace('local').then((referenceSpace) => {
                        this.renderer.xr.setReferenceSpace(referenceSpace);
                    });

                    hitTestSourceRequested = true;
                }

                if (hitTestSource) {
                    const hitTestResults = frame.getHitTestResults(hitTestSource);
                    if (hitTestResults.length) {
                        const hit = hitTestResults[0];
                        this.reticle.visible = true;
                        this.reticle.matrix.fromArray(hit.getPose(this.renderer.xr.getReferenceSpace()).transform.matrix);
                    } else {
                        this.reticle.visible = false;
                    }
                }

                // Update controller interaction
                if (this.controller1.userData.selectedObject) {
                    const object = this.controller1.userData.selectedObject;
                    const controller = this.controller1;
                    const delta = controller.position.clone()
                        .sub(controller.userData.initialControllerPosition);
                    object.position.copy(controller.userData.initialPosition).add(delta);
                }

                if (this.controller2.userData.selectedObject) {
                    const object = this.controller2.userData.selectedObject;
                    const controller = this.controller2;
                    const delta = controller.position.clone()
                        .sub(controller.userData.initialControllerPosition);
                    object.position.copy(controller.userData.initialPosition).add(delta);
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
}

const app = new App();
app.loadDefaultModels();

export default app;
