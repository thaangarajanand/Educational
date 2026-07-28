import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type RobotEmotion = 'happy' | 'sad' | 'love' | 'dance' | 'thinking';

interface Robot3DCanvasProps {
  isSpeaking: boolean;
  isThinking?: boolean;
  emotion?: RobotEmotion;
}

export const Robot3DCanvas: React.FC<Robot3DCanvasProps> = ({
  isSpeaking,
  isThinking = false,
  emotion = 'happy',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef(isSpeaking);
  const thinkingRef = useRef(isThinking);
  const emotionRef = useRef(emotion);

  useEffect(() => {
    speakingRef.current = isSpeaking;
    thinkingRef.current = isThinking;
    emotionRef.current = emotion;
  }, [isSpeaking, isThinking, emotion]);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 380;
    const height = container.clientHeight || 340;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0.2, 5.8);

    // 2. High-Quality WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Studio 2050 Cyber Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.4); // Cyber Cyan Key Light
    mainLight.position.set(4, 7, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xc084fc, 1.5); // Neon Purple Fill Light
    fillLight.position.set(-5, 3, 4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xf43f5e, 2.5, 8); // Rose Rim Light
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // 4. Robot Master Group
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // 5. 2050 Futuristic Materials
    const cyberPearlArmor = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.08,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: 0.95,
    });

    const darkCyberVisor = new THREE.MeshPhysicalMaterial({
      color: 0x090d16,
      metalness: 0.95,
      roughness: 0.04,
      transmission: 0.15,
      transparent: true,
      opacity: 0.96,
    });

    const neonCyanGlow = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const neonPurpleGlow = new THREE.MeshBasicMaterial({ color: 0xc084fc });
    const neonRoseGlow = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const cyberJoint = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.2 });

    // ====================================================
    // 2050 CYBER HEAD & HELMET ASSEMBLY
    // ====================================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.7, 0);
    robotGroup.add(headGroup);

    // Outer Pearl Helmet Sphere
    const helmetGeo = new THREE.SphereGeometry(0.92, 32, 32);
    const helmetMesh = new THREE.Mesh(helmetGeo, cyberPearlArmor);
    headGroup.add(helmetMesh);

    // Curved Dark Visor Shield
    const visorGeo = new THREE.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const visorMesh = new THREE.Mesh(visorGeo, darkCyberVisor);
    visorMesh.rotation.x = Math.PI / 2.2;
    visorMesh.position.set(0, 0.06, 0.18);
    headGroup.add(visorMesh);

    // Glowing LED Visor Border Tube (Exact Cyberpunk Rim)
    const visorRimGeo = new THREE.TorusGeometry(0.8, 0.03, 16, 64);
    const visorRimMesh = new THREE.Mesh(visorRimGeo, neonCyanGlow);
    visorRimMesh.rotation.x = Math.PI / 2.2;
    visorRimMesh.position.set(0, 0.06, 0.18);
    headGroup.add(visorRimMesh);

    // Ear Node Pods (Left & Right)
    const earGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 24);
    const leftEar = new THREE.Mesh(earGeo, cyberJoint);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-0.92, 0.05, 0);
    headGroup.add(leftEar);

    const earRingGeo = new THREE.TorusGeometry(0.2, 0.02, 16, 32);
    const leftEarRing = new THREE.Mesh(earRingGeo, neonCyanGlow);
    leftEarRing.rotation.y = Math.PI / 2;
    leftEarRing.position.set(-0.98, 0.05, 0);
    headGroup.add(leftEarRing);

    const rightEar = new THREE.Mesh(earGeo, cyberJoint);
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(0.92, 0.05, 0);
    headGroup.add(rightEar);

    const rightEarRing = new THREE.Mesh(earRingGeo, neonCyanGlow);
    rightEarRing.rotation.y = Math.PI / 2;
    rightEarRing.position.set(0.98, 0.05, 0);
    headGroup.add(rightEarRing);

    // Top Antenna Crystal Node
    const antStemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
    const antStem = new THREE.Mesh(antStemGeo, cyberJoint);
    antStem.position.set(0, 1.05, 0);
    headGroup.add(antStem);

    const antCrystalGeo = new THREE.OctahedronGeometry(0.09);
    const antCrystal = new THREE.Mesh(antCrystalGeo, neonCyanGlow);
    antCrystal.position.set(0, 1.25, 0);
    headGroup.add(antCrystal);

    // ====================================================
    // 3D DIGITAL LED FACE EYES & MORPHING LIPS (PURE WEBGL)
    // ====================================================
    const faceGroup = new THREE.Group();
    faceGroup.position.set(0, 0.08, 0.88);
    headGroup.add(faceGroup);

    // 3D LED Eye Arches ^ ^ (Left & Right)
    const eyeArcGeo = new THREE.TorusGeometry(0.12, 0.03, 12, 24, Math.PI);
    
    const leftEye = new THREE.Mesh(eyeArcGeo, neonCyanGlow);
    leftEye.position.set(-0.28, 0.08, 0);
    faceGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeArcGeo, neonCyanGlow);
    rightEye.position.set(0.28, 0.08, 0);
    faceGroup.add(rightEye);

    // 3D Heart Eyes ♥ ♥ (Love Mode)
    const heartGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const leftHeartEye = new THREE.Mesh(heartGeo, neonRoseGlow);
    leftHeartEye.position.set(-0.28, 0.08, 0);
    leftHeartEye.visible = false;
    faceGroup.add(leftHeartEye);

    const rightHeartEye = new THREE.Mesh(heartGeo, neonRoseGlow);
    rightHeartEye.position.set(0.28, 0.08, 0);
    rightHeartEye.visible = false;
    faceGroup.add(rightHeartEye);

    // 3D LED Smile Arc
    const smileGeo = new THREE.TorusGeometry(0.2, 0.028, 12, 24, Math.PI * 0.85);
    const smileMesh = new THREE.Mesh(smileGeo, neonCyanGlow);
    smileMesh.rotation.z = Math.PI;
    smileMesh.position.set(0, -0.2, 0);
    faceGroup.add(smileMesh);

    // 3D Upper & Lower Lip Meshes (Morphs Live with Speech Visemes!)
    const upperLipGeo = new THREE.TorusGeometry(0.15, 0.024, 12, 24, Math.PI);
    const upperLip = new THREE.Mesh(upperLipGeo, neonCyanGlow);
    upperLip.rotation.x = Math.PI;
    upperLip.position.set(0, -0.15, 0.02);
    faceGroup.add(upperLip);

    const lowerLipGeo = new THREE.TorusGeometry(0.15, 0.028, 12, 24, Math.PI);
    const lowerLip = new THREE.Mesh(lowerLipGeo, neonCyanGlow);
    lowerLip.position.set(0, -0.24, 0.02);
    faceGroup.add(lowerLip);

    // ====================================================
    // 2050 CHEST ARMOR & FULL 3D SKELETAL LIMBS
    // ====================================================
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.45, 0);
    robotGroup.add(torsoGroup);

    // Glossy White Chest Armor
    const chestGeo = new THREE.CylinderGeometry(0.65, 0.48, 0.85, 32);
    const chestMesh = new THREE.Mesh(chestGeo, cyberPearlArmor);
    torsoGroup.add(chestMesh);

    // Glowing Chest Reactor Core
    const coreGeo = new THREE.TorusGeometry(0.15, 0.03, 16, 32);
    const coreMesh = new THREE.Mesh(coreGeo, neonCyanGlow);
    coreMesh.position.set(0, 0.1, 0.58);
    torsoGroup.add(coreMesh);

    // Floating Shoulder Spheres (Left & Right)
    const shoulderGeo = new THREE.SphereGeometry(0.18, 16, 16);
    
    // Left Arm
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.8, 0.22, 0);
    torsoGroup.add(leftArmGroup);

    const leftShoulder = new THREE.Mesh(shoulderGeo, cyberJoint);
    leftArmGroup.add(leftShoulder);

    const bicepGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.32, 16);
    const leftBicep = new THREE.Mesh(bicepGeo, cyberPearlArmor);
    leftBicep.position.set(-0.15, -0.18, 0.08);
    leftBicep.rotation.z = Math.PI / 4;
    leftArmGroup.add(leftBicep);

    const handGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const leftHand = new THREE.Mesh(handGeo, cyberPearlArmor);
    leftHand.position.set(-0.35, -0.4, 0.2);
    leftArmGroup.add(leftHand);

    // 5 Finger Meshes
    for (let f = 0; f < 5; f++) {
      const fingerGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.1, 8);
      const finger = new THREE.Mesh(fingerGeo, cyberJoint);
      finger.position.set(-0.38 + (f * 0.02), -0.48, 0.2 + (f * 0.02));
      leftArmGroup.add(finger);
    }

    // Right Arm
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.8, 0.22, 0);
    torsoGroup.add(rightArmGroup);

    const rightShoulder = new THREE.Mesh(shoulderGeo, cyberJoint);
    rightArmGroup.add(rightShoulder);

    const rightBicep = new THREE.Mesh(bicepGeo, cyberPearlArmor);
    rightBicep.position.set(0.15, -0.18, 0);
    rightBicep.rotation.z = -Math.PI / 4;
    rightArmGroup.add(rightBicep);

    const rightHand = new THREE.Mesh(handGeo, cyberPearlArmor);
    rightHand.position.set(0.35, -0.4, 0.1);
    rightArmGroup.add(rightHand);

    for (let f = 0; f < 5; f++) {
      const fingerGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.1, 8);
      const finger = new THREE.Mesh(fingerGeo, cyberJoint);
      finger.position.set(0.33 + (f * 0.02), -0.48, 0.1 + (f * 0.02));
      rightArmGroup.add(finger);
    }

    // Legs & Glowing LED Soles
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.35, -0.48, 0);
    torsoGroup.add(leftLegGroup);

    const thighGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.4, 16);
    const leftThigh = new THREE.Mesh(thighGeo, cyberPearlArmor);
    leftLegGroup.add(leftThigh);

    const footGeo = new THREE.BoxGeometry(0.28, 0.14, 0.4);
    const leftFoot = new THREE.Mesh(footGeo, cyberPearlArmor);
    leftFoot.position.set(0, -0.28, 0.08);
    leftLegGroup.add(leftFoot);

    const soleGeo = new THREE.BoxGeometry(0.24, 0.03, 0.35);
    const leftSole = new THREE.Mesh(soleGeo, neonCyanGlow);
    leftSole.position.set(0, -0.36, 0.08);
    leftLegGroup.add(leftSole);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.35, -0.48, 0);
    torsoGroup.add(rightLegGroup);

    const rightThigh = new THREE.Mesh(thighGeo, cyberPearlArmor);
    rightLegGroup.add(rightThigh);

    const rightFoot = new THREE.Mesh(footGeo, cyberPearlArmor);
    rightFoot.position.set(0, -0.28, 0.08);
    rightLegGroup.add(rightFoot);

    const rightSole = new THREE.Mesh(soleGeo, neonCyanGlow);
    rightSole.position.set(0, -0.36, 0.08);
    rightLegGroup.add(rightSole);

    // Floating 2050 Orbiting Energy Rings
    const orbitRingGeo = new THREE.TorusGeometry(1.35, 0.015, 16, 64);
    const orbitRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = Math.PI / 2.3;
    robotGroup.add(orbitRing);

    // ====================================================
    // MOUSE CURSOR HEAD & EYE TRACKING + ANIMATION LOOP
    // ====================================================
    let targetRotX = 0;
    let targetRotY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      const y = -(((event.clientY - rect.top) / container.clientHeight) * 2 - 1);
      targetRotY = Math.max(-0.5, Math.min(0.5, x * 0.45));
      targetRotX = Math.max(-0.3, Math.min(0.3, -y * 0.35));
    };

    window.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;
    let clock = new THREE.Clock();
    let danceAngle = 0;
    let blinkTimer = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      const currentlySpeaking = speakingRef.current;
      const currentlyThinking = thinkingRef.current;
      const currentEmotion = emotionRef.current;

      // Smooth Head Mouse Tracking (Slerp-like Lerp)
      headGroup.rotation.y += (targetRotY - headGroup.rotation.y) * 0.08;
      headGroup.rotation.x += (targetRotX - headGroup.rotation.x) * 0.08;

      // 3D Eye & Visor Tracking
      faceGroup.position.x = (targetRotY * 0.08);
      faceGroup.position.y = 0.08 + (targetRotX * 0.05);

      // Body Gentle Hovering
      robotGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.06;
      orbitRing.rotation.z = elapsedTime * 0.4;
      antCrystal.rotation.y = elapsedTime * 2;

      // ----------------------------------------------------
      // EMOTION & DANCE STATE MACHINE
      // ----------------------------------------------------
      if (currentEmotion === 'dance') {
        danceAngle += 0.1;
        robotGroup.position.x = Math.sin(danceAngle * 1.5) * 0.3;
        robotGroup.position.y = Math.abs(Math.cos(danceAngle * 3)) * 0.15;
        robotGroup.rotation.z = Math.sin(danceAngle * 1.5) * 0.12;

        leftArmGroup.rotation.z = Math.sin(danceAngle * 3) * 0.6 + 0.3;
        rightArmGroup.rotation.z = -Math.sin(danceAngle * 3) * 0.6 - 0.3;
        headGroup.rotation.z = Math.sin(danceAngle * 3) * 0.15;

        const partyHue = (Math.sin(elapsedTime * 6) + 1) / 2;
        neonCyanGlow.color.setHSL(partyHue, 1.0, 0.55);

        leftEye.visible = true;
        rightEye.visible = true;
        leftHeartEye.visible = false;
        rightHeartEye.visible = false;

      } else if (currentEmotion === 'sad') {
        robotGroup.position.x = 0;
        robotGroup.rotation.z = 0;

        headGroup.rotation.z = -0.15;
        leftArmGroup.rotation.z = 0.4;
        rightArmGroup.rotation.z = -0.4;
        leftArmGroup.position.z = 0.2;
        rightArmGroup.position.z = 0.2;

        neonCyanGlow.color.setHex(0xf59e0b); // Amber LED
        leftEye.rotation.z = Math.PI; // Downturned sad eyes u u
        rightEye.rotation.z = Math.PI;
        leftEye.visible = true;
        rightEye.visible = true;
        leftHeartEye.visible = false;
        rightHeartEye.visible = false;

      } else if (currentEmotion === 'love') {
        robotGroup.position.x = 0;
        robotGroup.rotation.z = Math.sin(elapsedTime * 2) * 0.05;

        leftArmGroup.rotation.z = 0.8 + Math.sin(elapsedTime * 5) * 0.2;
        rightArmGroup.rotation.z = -0.8 - Math.sin(elapsedTime * 5) * 0.2;

        neonCyanGlow.color.setHex(0xf43f5e);
        leftEye.visible = false;
        rightEye.visible = false;
        leftHeartEye.visible = true;
        rightHeartEye.visible = true;

      } else {
        // DEFAULT HAPPY / MENTOR STATE
        robotGroup.position.x = 0;
        robotGroup.rotation.z = 0;

        leftArmGroup.rotation.z = 0.1;
        rightArmGroup.rotation.z = -0.1;

        neonCyanGlow.color.setHex(0x38bdf8);
        leftEye.rotation.z = 0;
        rightEye.rotation.z = 0;
        leftEye.visible = true;
        rightEye.visible = true;
        leftHeartEye.visible = false;
        rightHeartEye.visible = false;
      }

      // REAL-TIME LIPS SYNC SPEECH MORPHING (PURE WEBGL)
      if (currentlySpeaking) {
        const mouthValue = Math.max(0.04, (Math.sin(elapsedTime * 30) * 0.5 + Math.cos(elapsedTime * 18) * 0.3 + 0.4) * 0.09);
        upperLip.position.y = -0.15 + mouthValue;
        lowerLip.position.y = -0.24 - mouthValue * 1.5;
        smileMesh.scale.y = 1.0 + mouthValue * 3.0;
        headGroup.rotation.z += Math.sin(elapsedTime * 8) * 0.02;
      } else {
        upperLip.position.y = -0.15;
        lowerLip.position.y = -0.24;
        smileMesh.scale.y = 1.0;
      }

      // EYE BLINKING ANIMATION (Every 3.4s)
      blinkTimer += 0.016;
      if (blinkTimer > 3.4 && blinkTimer < 3.55) {
        leftEye.scale.y = 0.05;
        rightEye.scale.y = 0.05;
      } else {
        leftEye.scale.y = 1.0;
        rightEye.scale.y = 1.0;
        if (blinkTimer > 3.6) blinkTimer = 0;
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
      className="w-full h-full min-h-[320px] max-h-[390px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none" 
    />
  );
};
