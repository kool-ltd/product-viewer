class App {
    constructor() {
        this.init();
        this.setupScene();
        this.setupLights();
        this.setupControls();
        this.animate();
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
        this.camera.position.set(0, 0, 3);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
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

    setupControls() {
        this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.dragControls = new THREE.DragControls([], this.camera, this.renderer.domElement);
        
        this.dragControls.addEventListener('dragstart', () => {
            this.orbitControls.enabled = false;
        });

        this.dragControls.addEventListener('dragend', () => {
            this.orbitControls.enabled = true;
        });
    }

    loadModel(url, name) {
        const loader = new THREE.GLTFLoader();
        loader.load(url, 
            (gltf) => {
                const model = gltf.scene;
                this.scene.add(model);
                this.loadedModels.set(name, model);
                
                // Update drag controls
                const objects = Array.from(this.loadedModels.values());
                this.dragControls = new THREE.DragControls(objects, this.camera, this.renderer.domElement);
                this.setupControls();

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

// Start the application
const app = new App();
app.loadDefaultModels();
