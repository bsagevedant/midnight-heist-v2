import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RefreshCw, Twitter } from 'lucide-react';

// Create audio context and sounds
const createAudio = () => {
  const context = new AudioContext();
  
  // Create collect sound (short sparkly sound)
  const createCollectSound = async () => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const stereoPanner = context.createStereoPanner();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.1);
    
    oscillator.connect(stereoPanner);
    stereoPanner.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  };
  
  // Create game over sound (dramatic low tone)
  const createGameOverSound = async () => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(220, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(55, context.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.5);
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
  };
  
  // Create footstep sound
  const createFootstepSound = async () => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const filter = context.createBiquadFilter();
    
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(100, context.currentTime);
    
    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, context.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.08);
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
  };

  return {
    playCollect: createCollectSound,
    playGameOver: createGameOverSound,
    playFootstep: createFootstepSound,
    resume: () => context.resume()
  };
};

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<ReturnType<typeof createAudio>>();
  const footstepTimeoutRef = useRef<number>();
  const [gameState, setGameState] = useState<{ score: number; isGameOver: boolean }>({
    score: 0,
    isGameOver: false
  });
  
  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize audio
    audioRef.current = createAudio();

    // Game variables
    let score = 0;
    let isGameOver = false;
    let lastFootstepTime = 0;
    
    // Set up the scene with fog for depth
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000033);
    scene.fog = new THREE.Fog(0x000033, 1, 50);
    
    // Set up the camera with better perspective
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 6;
    camera.position.y = 3;
    camera.rotation.x = -0.3;
    
    // Set up the renderer with shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    
    // Add lights with shadows
    const moonLight = new THREE.DirectionalLight(0x6666ff, 0.5);
    moonLight.position.set(15, 10, -10);
    moonLight.castShadow = true;
    moonLight.shadow.camera.near = 0.1;
    moonLight.shadow.camera.far = 100;
    moonLight.shadow.camera.left = -20;
    moonLight.shadow.camera.right = 20;
    moonLight.shadow.camera.top = 20;
    moonLight.shadow.camera.bottom = -20;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    scene.add(moonLight);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    // Create spotlight to follow player
    const playerSpotlight = new THREE.SpotLight(0x4444ff, 0.8, 8, Math.PI / 4, 0.5, 1);
    playerSpotlight.position.set(0, 4, 0);
    playerSpotlight.castShadow = true;
    scene.add(playerSpotlight);
    
    // Create the player (thief) with better materials
    const playerGroup = new THREE.Group();
    
    // Thief body with more visible material
    const bodyGeometry = new THREE.BoxGeometry(0.4, 0.6, 0.3);
    const bodyMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0x444444,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x222222,
      emissiveIntensity: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.3;
    body.castShadow = true;
    playerGroup.add(body);
    
    // Thief head with better visibility
    const headGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const headMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0x444444,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x222222,
      emissiveIntensity: 0.2
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 0.7;
    head.castShadow = true;
    playerGroup.add(head);

    // Add glowing eyes
    const eyeGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const eyeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 1,
      metalness: 1,
      roughness: 0
    });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.08, 0.75, 0.15);
    playerGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.08, 0.75, 0.15);
    playerGroup.add(rightEye);

    // Add a cape
    const capeGeometry = new THREE.ConeGeometry(0.3, 0.7, 8, 1, true);
    const capeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x000066,
      metalness: 0.1,
      roughness: 0.8,
      emissive: 0x000033,
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide
    });
    const cape = new THREE.Mesh(capeGeometry, capeMaterial);
    cape.position.set(0, 0.4, 0.1);
    cape.rotation.x = 0.2;
    playerGroup.add(cape);

    // Add player glow
    const playerGlowGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    const playerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x4444ff,
      transparent: true,
      opacity: 0.1
    });
    const playerGlow = new THREE.Mesh(playerGlowGeometry, playerGlowMaterial);
    playerGlow.position.y = 0.4;
    playerGroup.add(playerGlow);
    
    scene.add(playerGroup);
    
    // Create the ground with better texture
    const groundGeometry = new THREE.PlaneGeometry(100, 100, 100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x227722,
      metalness: 0.1,
      roughness: 0.8,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    ground.receiveShadow = true;
    
    // Add displacement to ground for more terrain-like appearance
    const vertices = ground.geometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      if (Math.abs(vertices[i]) > 20 || Math.abs(vertices[i + 2]) > 20) {
        vertices[i + 1] = Math.sin(vertices[i] * 0.1) * Math.cos(vertices[i + 2] * 0.1) * 0.5;
      }
    }
    ground.geometry.computeVertexNormals();
    scene.add(ground);
    
    // Create trees with better materials
    function createTree(x: number, z: number) {
      const treeGroup = new THREE.Group();
      
      // Tree trunk with bark-like texture
      const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        metalness: 0.1,
        roughness: 0.9
      });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 0.5;
      trunk.castShadow = true;
      treeGroup.add(trunk);
      
      // Tree foliage with more detailed geometry
      const foliageGeometry = new THREE.DodecahedronGeometry(0.8, 1);
      const foliageMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x228B22,
        metalness: 0.1,
        roughness: 0.8
      });
      
      const foliage1 = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage1.position.y = 1.3;
      foliage1.castShadow = true;
      treeGroup.add(foliage1);
      
      const foliage2 = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage2.position.y = 1.8;
      foliage2.scale.set(0.8, 0.8, 0.8);
      foliage2.castShadow = true;
      treeGroup.add(foliage2);
      
      const foliage3 = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage3.position.y = 2.3;
      foliage3.scale.set(0.6, 0.6, 0.6);
      foliage3.castShadow = true;
      treeGroup.add(foliage3);
      
      treeGroup.position.set(x, 0, z);
      scene.add(treeGroup);
      
      return treeGroup;
    }
    
    // Create houses with better materials and details
    function createHouse(x: number, z: number, rotation: number) {
      const houseGroup = new THREE.Group();
      
      // House base with brick-like material
      const baseGeometry = new THREE.BoxGeometry(2, 1.5, 2);
      const baseMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xDEB887,
        metalness: 0.1,
        roughness: 0.8
      });
      const base = new THREE.Mesh(baseGeometry, baseMaterial);
      base.position.y = 0.75;
      base.castShadow = true;
      base.receiveShadow = true;
      houseGroup.add(base);
      
      // House roof with tiles effect
      const roofGeometry = new THREE.ConeGeometry(1.5, 1, 4, 4);
      const roofMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B0000,
        metalness: 0.3,
        roughness: 0.7
      });
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);
      roof.position.y = 2;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      houseGroup.add(roof);
      
      // Door with frame
      const doorGroup = new THREE.Group();
      const doorGeometry = new THREE.BoxGeometry(0.4, 0.8, 0.1);
      const doorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4B3621,
        metalness: 0.2,
        roughness: 0.8
      });
      const door = new THREE.Mesh(doorGeometry, doorMaterial);
      door.castShadow = true;
      doorGroup.add(door);
      
      // Door frame
      const frameGeometry = new THREE.BoxGeometry(0.5, 0.9, 0.15);
      const frameMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        metalness: 0.1,
        roughness: 0.9
      });
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.z = -0.02;
      doorGroup.add(frame);
      
      doorGroup.position.set(0, 0.4, 1.01);
      houseGroup.add(doorGroup);
      
      // Windows with glass effect
      const windowGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.1);
      const windowMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x87CEEB,
        metalness: 0.9,
        roughness: 0.1,
        transmission: 0.5,
        transparent: true
      });
      
      const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
      window1.position.set(-0.5, 0.8, 1.01);
      houseGroup.add(window1);
      
      const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
      window2.position.set(0.5, 0.8, 1.01);
      houseGroup.add(window2);
      
      // Side windows
      const sideWindow1 = new THREE.Mesh(windowGeometry, windowMaterial);
      sideWindow1.position.set(1.01, 0.8, 0);
      sideWindow1.rotation.y = Math.PI / 2;
      houseGroup.add(sideWindow1);
      
      const sideWindow2 = new THREE.Mesh(windowGeometry, windowMaterial);
      sideWindow2.position.set(-1.01, 0.8, 0);
      sideWindow2.rotation.y = Math.PI / 2;
      houseGroup.add(sideWindow2);
      
      // Add a volumetric light inside the house
      const houseLight = new THREE.PointLight(0xffffaa, 1, 3);
      houseLight.position.set(0, 0.8, 0);
      houseGroup.add(houseLight);
      
      houseGroup.position.set(x, 0, z);
      houseGroup.rotation.y = rotation;
      scene.add(houseGroup);
      
      return houseGroup;
    }
    
    // Create environment
    const trees: THREE.Group[] = [];
    const houses: THREE.Group[] = [];
    
    // Create trees in random positions
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 40 - 20;
      const z = Math.random() * 40 - 20;
      if (Math.abs(x) > 8 || Math.abs(z) > 8) {
        trees.push(createTree(x, z));
      }
    }
    
    // Create houses
    houses.push(createHouse(-12, -12, Math.PI / 4));
    houses.push(createHouse(12, -12, -Math.PI / 4));
    houses.push(createHouse(-12, 12, -Math.PI / 4 * 3));
    houses.push(createHouse(12, 12, Math.PI / 4 * 3));
    
    // Create jewels with better materials
    const jewels: THREE.Group[] = [];
    const securityAlarms: THREE.Group[] = [];
    
    function createJewel() {
      const jewel = new THREE.Group();
      
      // Create diamond shape with crystal material
      const diamondGeometry = new THREE.OctahedronGeometry(0.2, 2);
      const diamondMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0x00ff88,
        metalness: 0.9,
        roughness: 0.1,
        transmission: 0.6,
        thickness: 0.5,
        envMapIntensity: 1
      });
      const diamond = new THREE.Mesh(diamondGeometry, diamondMaterial);
      diamond.castShadow = true;
      
      // Create base with metallic finish
      const baseGeometry = new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16);
      const baseMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xcccccc,
        metalness: 0.9,
        roughness: 0.1
      });
      const base = new THREE.Mesh(baseGeometry, baseMaterial);
      base.position.y = -0.15;
      base.castShadow = true;
      
      // Add glow effect
      const glowGeometry = new THREE.SphereGeometry(0.25, 32, 32);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.2
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      
      jewel.add(diamond);
      jewel.add(base);
      jewel.add(glow);
      
      jewel.position.x = Math.random() * 16 - 8;
      jewel.position.z = Math.random() * 16 - 8;
      jewel.position.y = 0.15;
      
      scene.add(jewel);
      jewels.push(jewel);
    }
    
    function createSecurityAlarm() {
      const alarm = new THREE.Group();
      
      // Create alarm body with metallic finish
      const alarmBodyGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.3);
      const alarmBodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.8,
        roughness: 0.2
      });
      const alarmBody = new THREE.Mesh(alarmBodyGeometry, alarmBodyMaterial);
      alarmBody.castShadow = true;
      
      // Create alarm light with emission
      const alarmLightGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16);
      const alarmLightMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5,
        metalness: 0.9,
        roughness: 0.1
      });
      const alarmLight = new THREE.Mesh(alarmLightGeometry, alarmLightMaterial);
      alarmLight.position.y = 0.1;
      
      alarm.add(alarmBody);
      alarm.add(alarmLight);
      
      alarm.position.x = Math.random() * 16 - 8;
      alarm.position.z = Math.random() * 16 - 8;
      alarm.position.y = 0.05;
      
      scene.add(alarm);
      securityAlarms.push(alarm);
    }
    
    // Create initial jewels and security alarms
    for (let i = 0; i < 10; i++) {
      createJewel();
    }
    
    for (let i = 0; i < 5; i++) {
      createSecurityAlarm();
    }
    
    // Create paths with better materials
    function createPath(x1: number, z1: number, x2: number, z2: number) {
      const pathWidth = 1;
      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(z2 - z1, 2));
      const pathGeometry = new THREE.PlaneGeometry(length, pathWidth, 20, 2);
      const pathMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        metalness: 0.1,
        roughness: 0.9,
        side: THREE.DoubleSide
      });
      const path = new THREE.Mesh(pathGeometry, pathMaterial);
      
      // Add slight displacement to path vertices for texture
      const vertices = path.geometry.attributes.position.array;
      for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 1] = Math.random() * 0.05;
      }
      path.geometry.computeVertexNormals();
      
      path.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
      path.rotation.x = Math.PI / 2;
      path.rotation.y = Math.atan2(z2 - z1, x2 - x1);
      path.receiveShadow = true;
      
      scene.add(path);
    }
    
    // Create paths between houses
    createPath(-12, -12, 12, -12);
    createPath(12, -12, 12, 12);
    createPath(12, 12, -12, 12);
    createPath(-12, 12, -12, -12);
    createPath(-12, -12, 12, 12);
    createPath(-12, 12, 12, -12);
    
    // Handle keyboard input
    const keys: { [key: string]: boolean } = {};
    const handleKeyDown = (event: KeyboardEvent) => {
      keys[event.key] = true;
      audioRef.current?.resume();
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
      keys[event.key] = false;
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    function movePlayer() {
      if (isGameOver) return;
      
      const moveSpeed = 0.1;
      let isMoving = false;
      
      if (keys['w'] || keys['W'] || keys['ArrowUp']) {
        playerGroup.position.z -= moveSpeed;
        playerGroup.rotation.y = Math.PI;
        isMoving = true;
      }
      if (keys['s'] || keys['S'] || keys['ArrowDown']) {
        playerGroup.position.z += moveSpeed;
        playerGroup.rotation.y = 0;
        isMoving = true;
      }
      if (keys['a'] || keys['A'] || keys['ArrowLeft']) {
        playerGroup.position.x -= moveSpeed;
        playerGroup.rotation.y = Math.PI/2;
        isMoving = true;
      }
      if (keys['d'] || keys['D'] || keys['ArrowRight']) {
        playerGroup.position.x += moveSpeed;
        playerGroup.rotation.y = -Math.PI/2;
        isMoving = true;
      }
      
      // Play footstep sound when moving
      if (isMoving) {
        const now = Date.now();
        if (now - lastFootstepTime > 300) { // Play footstep every 300ms while moving
          audioRef.current?.playFootstep();
          lastFootstepTime = now;
        }
      }
      
      playerGroup.position.x = Math.max(-15, Math.min(15, playerGroup.position.x));
      playerGroup.position.z = Math.max(-15, Math.min(15, playerGroup.position.z));
      
      camera.position.x = playerGroup.position.x;
      camera.position.z = playerGroup.position.z + 6;

      // Update spotlight position to follow player
      playerSpotlight.position.set(
        playerGroup.position.x,
        4,
        playerGroup.position.z
      );
      playerSpotlight.target = playerGroup;
    }
    
    function checkCollisions() {
      if (isGameOver) return;
      
      for (let i = jewels.length - 1; i >= 0; i--) {
        const distance = new THREE.Vector3().subVectors(playerGroup.position, jewels[i].position).length();
        if (distance < 0.5) {
          scene.remove(jewels[i]);
          jewels.splice(i, 1);
          score += 1;
          setGameState(prev => ({ ...prev, score }));
          
          // Play collect sound
          audioRef.current?.playCollect();
          
          createJewel();
          
          if (score % 5 === 0) {
            createSecurityAlarm();
          }
        }
      }
      
      for (let i = 0; i < securityAlarms.length; i++) {
        const distance = new THREE.Vector3().subVectors(playerGroup.position, securityAlarms[i].position).length();
        if (distance < 0.5) {
          gameOver();
          break;
        }
      }
    }
    
    function gameOver() {
      isGameOver = true;
      setGameState(prev => ({ ...prev, isGameOver: true }));
      body.material.color.set(0x888888);
      head.material.color.set(0x888888);
      
      // Play game over sound
      audioRef.current?.playGameOver();
    }
    
    // Create moon with better material
    const moonGeometry = new THREE.SphereGeometry(1, 32, 32);
    const moonMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xeeeeee,
      emissive: 0x888888,
      emissiveIntensity: 0.5,
      metalness: 0.1,
      roughness: 0.8
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.set(15, 10, -10);
    scene.add(moon);
    
    function animate() {
      requestAnimationFrame(animate);
      
      movePlayer();
      checkCollisions();
      
      // Animate cape
      const cape = playerGroup.children[4];
      if (cape) {
        cape.rotation.x = 0.2 + Math.sin(Date.now() * 0.003) * 0.1;
      }

      // Animate player glow
      const playerGlow = playerGroup.children[5];
      if (playerGlow) {
        playerGlow.scale.setScalar(1 + Math.sin(Date.now() * 0.003) * 0.1);
      }
      
      jewels.forEach(jewel => {
        jewel.rotation.y += 0.01;
        jewel.position.y = 0.15 + Math.sin(Date.now() * 0.003) * 0.05;
        
        // Animate glow
        const glow = jewel.children[2];
        glow.scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.1);
      });
      
      securityAlarms.forEach((alarm, index) => {
        const light = alarm.children[1];
        if (light instanceof THREE.Mesh) {
          const blinkRate = 0.002;
          const blinkPhase = index * 0.7;
          const blinkIntensity = Math.sin(Date.now() * blinkRate + blinkPhase) * 0.5 + 0.5;
          (light.material as THREE.MeshPhysicalMaterial).emissiveIntensity = blinkIntensity;
        }
      });
      
      renderer.render(scene, camera);
    }
    
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      containerRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  const handleReplay = () => {
    window.location.reload();
  };

  return (
    <div className="relative w-full h-screen">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-2xl font-bold text-shadow">
        Midnight Heist: The Jewel Thief
      </div>
      <a
        href="https://x.com/sagevedant"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors flex items-center gap-2"
      >
        <Twitter className="w-5 h-5" />
        <span>@sagevedant</span>
      </a>
      <div className="absolute top-4 left-4 text-white text-lg">
        Jewels: {gameState.score}
      </div>
      {gameState.isGameOver && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-white text-4xl mb-8">Caught by Security!</div>
          <button
            onClick={handleReplay}
            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Play Again
          </button>
        </div>
      )}
      <div className="absolute bottom-5 left-4 text-white text-sm">
        Use WASD or arrow keys to move<br />
        Collect jewels, avoid security alarms
      </div>
    </div>
  );
}