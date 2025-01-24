import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

export class InteractionManager {
    constructor(scene, camera, domElement) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;

        this.setupOrbitControls();
        this.setupDragControls();
    }

    setupOrbitControls() {
        this.orbitControls = new OrbitControls(this.camera, this.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
    }

    setupDragControls() {
        this.dragControls = new DragControls([], this.camera, this.domElement);
        
        this.dragControls.addEventListener('dragstart', () => {
            this.orbitControls.enabled = false;
        });

        this.dragControls.addEventListener('dragend', () => {
            this.orbitControls.enabled = true;
        });

        this.dragControls.addEventListener('drag', (event) => {
            // Prevent scaling during drag
            const object = event.object;
            if (object.userData.originalScale) {
                object.scale.copy(object.userData.originalScale);
            }
        });
    }

    setDraggableObjects(objects) {
        this.dragControls.dispose();
        this.dragControls = new DragControls(objects, this.camera, this.domElement);
        this.setupDragControlsEvents();
    }

    update() {
        this.orbitControls.update();
    }
}
