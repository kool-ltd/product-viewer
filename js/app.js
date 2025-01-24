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
        this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;

        this.dragControls = new THREE.DragControls([], this.camera, this.renderer.domElement);
        
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

    loadEnvironment() {
        const rgbeLoader = new THREE.RGBELoader();
        rgbeLoader.setDataType(THREE.UnsignedByteType);
        rgbeLoader.load('https://raw.githubusercontent.com/kool-ltd/product-viewer/refs/heads/main/assets/brown_photostudio_02_4k.hdr', 
            (texture) => {
                const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;
                this.scene.environment = envMap;
                this.scene.background = envMap;
                texture.dispose();
                pmremGenerator.dispose();
            },
            undefined,
            (error) => {
                console.error('Error loading environment map:', error);
            }
        );
    }

    loadModel(url, name) {
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();
            loader.load(url, 
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Store original scale
                    model.userData.originalScale = model.scale.clone();
                    
                    // Add to scene and store reference
                    this.scene.add(model);
                    this.loadedModels.set(name, model);
                    
                    // Update drag controls
                    this.dragControls.dispose();
                    this.dragControls = new THREE.DragControls(
                        Array.from(this.loadedModels.values()),
                        this.camera,
                        this.renderer.domElement
                    );
                    this.setupControls();

                    resolve(model);
                },
                undefined,
                (error) => {
                    console.error('Error loading model:', error);
                    reject(error);
                }
            );
        });
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
        this.renderer.
