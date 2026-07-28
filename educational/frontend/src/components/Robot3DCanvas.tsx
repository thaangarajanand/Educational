import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Robot3DCanvasProps {
  isSpeaking: boolean;
  isThinking?: boolean;
}

export const Robot3DCanvas: React.FC<Robot3DCanvasProps> = ({ isSpeaking, isThinking = false }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef(isSpeaking);
  const thinkingRef = useRef(isThinking);

  useEffect(() => {
    speakingRef.current = isSpeaking;
    thinkingRef.current = isThinking;
  }, [isSpeaking, isThinking]);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 240;
    const height = container.clientHeight || 240;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0.2, 5.8);

    // 2. WebGL Renderer with Shadow and Antialiasing
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Studio Metallic Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.2); // Cool cyan key light
    mainLight.position.set(4, 6, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x818cf8, 1.4); // Indigo fill light
    fillLight.position.set(-5, 2, -3);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xec4899, 1.8, 10); // Pink accent rim light
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    const chestLight = new THREE.PointLight(0x0284c7, 2.5, 4);
    chestLight.position.set(0, -0.2, 0.9);
    scene.add(chestLight);

    // 4. Robot 3D Master Group
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // 5. Materials (Metallic Gloss + Clearcoat)
    const whiteArmorMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 0.75,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.9,
    });

    const darkJointMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.2,
    });

    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      metalness: 0.95,
      roughness: 0.05,
      transmission: 0.2,
      transparent: true,
      opacity: 0.95,
    });

    const glowingEyeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    const glowingMouthMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
    });

    const glowingCoreMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
    });

    const antennaTipMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
    });

    // --- HEAD GROUP ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.75, 0);
    robotGroup.add(headGroup);

    // Outer Helmet Sphere
    const headGeo = new THREE.SphereGeometry(0.85, 32, 32);
    const headMesh = new THREE.Mesh(headGeo, whiteArmorMat);
    headGroup.add(headMesh);

    // Ear Capsules (Left & Right)
    const earGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 16);
    const leftEar = new THREE.Mesh(earGeo, darkJointMat);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-0.85, 0, 0);
    headGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, darkJointMat);
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(0.85, 0, 0);
    headGroup.add(rightEar);

    // Curved Dark Glass Visor
    const visorGeo = new THREE.SphereGeometry(0.72, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.rotation.x = Math.PI / 2.2;
    visorMesh.position.set(0, 0.08, 0.18);
    headGroup.add(visorMesh);

    // Glowing Eyes (Left & Right)
    const eyeGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16);
    const leftEye = new THREE.Mesh(eyeGeo, glowingEyeMat);
    leftEye.rotation.x = Math.PI / 2;
    leftEye.position.set(-0.28, 0.12, 0.8);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, glowingEyeMat);
    rightEye.rotation.x = Math.PI / 2;
    rightEye.position.set(0.28, 0.12, 0.8);
    headGroup.add(rightEye);

    // --- ANIMATED 3D JAW & LIP-SYNC MOUTH BAR ---
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, -0.22, 0.62);
    headGroup.add(jawGroup);

    // Metallic Lower Jaw Plate
    const jawPlateGeo = new THREE.BoxGeometry(0.42, 0.06, 0.18);
    const jawPlateMesh = new THREE.Mesh(jawPlateGeo, darkJointMat);
    jawGroup.add(jawPlateMesh);

    // Glowing Equalizer Mouth LED Bar
    const mouthBarGeo = new THREE.BoxGeometry(0.36, 0.05, 0.05);
    const mouthMesh = new THREE.Mesh(mouthBarGeo, glowingMouthMat);
    mouthMesh.position.set(0, 0.02, 0.05);
    jawGroup.add(mouthMesh);

    // Antenna Setup
    const antStemGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8);
    const antStem = new THREE.Mesh(antStemGeo, darkJointMat);
    antStem.position.set(0, 1.05, 0);
    headGroup.add(antStem);

    const antTipGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const antTip = new THREE.Mesh(antTipGeo, antennaTipMat);
    antTip.position.set(0, 1.28, 0);
    headGroup.add(antTip);

    // --- TORSO / BODY GROUP ---
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.45, 0);
    robotGroup.add(torsoGroup);

    // Upper Torso Chest Armor
    const torsoGeo = new THREE.CylinderGeometry(0.72, 0.52, 1.0, 32);
    const torsoMesh = new THREE.Mesh(torsoGeo, whiteArmorMat);
    torsoGroup.add(torsoMesh);

    // Chest Core Energy Reactor Ring
    const coreGeo = new THREE.TorusGeometry(0.18, 0.04, 16, 32);
    const coreMesh = new THREE.Mesh(coreGeo, glowingCoreMat);
    coreMesh.position.set(0, 0.1, 0.64);
    torsoGroup.add(coreMesh);

    // Shoulder Spheres
    const shoulderGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const leftShoulder = new THREE.Mesh(shoulderGeo, darkJointMat);
    leftShoulder.position.set(-0.85, 0.25, 0);
    torsoGroup.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeo, darkJointMat);
    rightShoulder.position.set(0.85, 0.25, 0);
    torsoGroup.add(rightShoulder);

    // Sci-Fi Floating Aura Ring
    const haloGeo = new THREE.TorusGeometry(1.4, 0.018, 16, 64);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
    const haloRing = new THREE.Mesh(haloGeo, haloMat);
    haloRing.rotation.x = Math.PI / 2.3;
    robotGroup.add(haloRing);

    // Cursor Tracking Variables
    let targetRotX = 0;
    let targetRotY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      const y = -(((event.clientY - rect.top) / container.clientHeight) * 2 - 1);
      targetRotY = Math.max(-0.6, Math.min(0.6, x * 0.5));
      targetRotX = Math.max(-0.35, Math.min(0.35, -y * 0.35));
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Render Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let blinkTimer = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth Head Tracking (Slerp-like Lerp)
      headGroup.rotation.y += (targetRotY - headGroup.rotation.y) * 0.08;
      headGroup.rotation.x += (targetRotX - headGroup.rotation.x) * 0.08;

      // Gentle Hovering Motion
      robotGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.06;
      haloRing.rotation.z = elapsedTime * 0.4;

      const currentlySpeaking = speakingRef.current;
      const currentlyThinking = thinkingRef.current;

      // REAL-TIME LIP SYNC & SPEECH ANIMATION
      if (currentlySpeaking) {
        // Multi-frequency harmonic mouth oscillation simulating human phonemes / visemes
        const speechFrequency1 = Math.sin(elapsedTime * 32) * 0.6;
        const speechFrequency2 = Math.cos(elapsedTime * 19) * 0.4;
        const mouthOpenAmount = Math.max(0.2, speechFrequency1 + speechFrequency2 + 0.4);

        // Animate Jaw Opening & Scaling
        jawGroup.scale.y = 1.0 + mouthOpenAmount * 0.9;
        jawGroup.scale.x = 1.0 + Math.cos(elapsedTime * 24) * 0.25;
        jawGroup.position.y = -0.22 - (mouthOpenAmount * 0.05);

        // Dynamic Glowing Colors (Cyan -> Magenta pulse synced with vocal rhythm)
        const pulseRatio = (Math.sin(elapsedTime * 14) + 1) / 2;
        glowingMouthMat.color.setHSL(0.52 + pulseRatio * 0.12, 1.0, 0.55);
        antennaTipMat.color.setHex(0x38bdf8);

        // Expressive Head Tilt
        headGroup.rotation.z = Math.sin(elapsedTime * 9) * 0.05;
        chestLight.intensity = 3.5 + Math.sin(elapsedTime * 15) * 1.5;
      } else if (currentlyThinking) {
        jawGroup.scale.set(1, 1, 1);
        jawGroup.position.y = -0.22;
        glowingMouthMat.color.setHex(0xa855f7);
        antennaTipMat.color.setHex(0xc084fc);
        headGroup.rotation.z = Math.sin(elapsedTime * 4) * 0.08;
        chestLight.intensity = 2.0;
      } else {
        // Rest / Idle State
        jawGroup.scale.set(1, 1, 1);
        jawGroup.position.y = -0.22;
        glowingMouthMat.color.setHex(0x0ea5e9);
        antennaTipMat.color.setHex(0x3b82f6);
        headGroup.rotation.z = 0;
        chestLight.intensity = 2.5;
      }

      // Realistic Eye Blinking (Every 3.8s)
      blinkTimer += 0.016;
      if (blinkTimer > 3.8 && blinkTimer < 3.95) {
        leftEye.scale.y = 0.08;
        rightEye.scale.y = 0.08;
      } else {
        leftEye.scale.y = 1.0;
        rightEye.scale.y = 1.0;
        if (blinkTimer > 4.0) blinkTimer = 0;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      className="w-full h-full min-h-[200px] max-h-[260px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none" 
    />
  );
};
