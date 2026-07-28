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
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0.1, 6.2);

    // 2. High-Quality WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting (Matching Clean White Reference Image)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.2); // Key Cyan Light
    mainLight.position.set(4, 7, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xf472b6, 1.2); // Warm Pink Fill Light
    fillLight.position.set(-4, 3, 4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 3, 8);
    rimLight.position.set(0, 2, -3);
    scene.add(rimLight);

    // 4. Robot Master Group
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // 5. Materials (Glossy White Armor + Dark Visor + Cyan LED Glow)
    const glossyWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.05,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 0.95,
    });

    const darkJointMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.2,
    });

    const darkGlassVisorMat = new THREE.MeshPhysicalMaterial({
      color: 0x090d16,
      metalness: 0.95,
      roughness: 0.03,
      transmission: 0.1,
      transparent: true,
      opacity: 0.96,
    });

    const cyanLedMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Bright Neon Cyan LED
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const pinkLedMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, // Heart Pink LED
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const amberLedMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Sad Amber LED
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    // ====================================================
    // HEAD & HELMET ASSEMBLY (Exact Match to Image 2)
    // ====================================================
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.75, 0);
    robotGroup.add(headGroup);

    // Outer Pearl White Helmet Sphere
    const helmetGeo = new THREE.SphereGeometry(0.95, 32, 32);
    const helmetMesh = new THREE.Mesh(helmetGeo, glossyWhiteMat);
    headGroup.add(helmetMesh);

    // Dark Curved Glass Visor Screen
    const visorGeo = new THREE.SphereGeometry(0.88, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const visorMesh = new THREE.Mesh(visorGeo, darkGlassVisorMat);
    visorMesh.rotation.x = Math.PI / 2.2;
    visorMesh.position.set(0, 0.06, 0.18);
    headGroup.add(visorMesh);

    // GLOWING CYAN LED RIM TUBE (Exact match to image visor border glow!)
    const visorRimGeo = new THREE.TorusGeometry(0.88, 0.035, 16, 64);
    const visorRimMesh = new THREE.Mesh(visorRimGeo, cyanLedMat);
    visorRimMesh.rotation.x = Math.PI / 2.2;
    visorRimMesh.position.set(0, 0.06, 0.18);
    visorRimMesh.renderOrder = 998;
    headGroup.add(visorRimMesh);

    // Ear Headphone Cups (Left & Right)
    const earGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 24);
    const leftEar = new THREE.Mesh(earGeo, darkJointMat);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-0.95, 0.05, 0);
    headGroup.add(leftEar);

    const earRingGeo = new THREE.TorusGeometry(0.24, 0.02, 16, 32);
    const leftEarRing = new THREE.Mesh(earRingGeo, cyanLedMat);
    leftEarRing.rotation.y = Math.PI / 2;
    leftEarRing.position.set(-1.01, 0.05, 0);
    headGroup.add(leftEarRing);

    const rightEar = new THREE.Mesh(earGeo, darkJointMat);
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(0.95, 0.05, 0);
    headGroup.add(rightEar);

    const rightEarRing = new THREE.Mesh(earRingGeo, cyanLedMat);
    rightEarRing.rotation.y = Math.PI / 2;
    rightEarRing.position.set(1.01, 0.05, 0);
    headGroup.add(rightEarRing);

    // ====================================================
    // HIGH-PRECISION 3D LED FACE EYES & MORPHING LIPS
    // ====================================================
    const faceGroup = new THREE.Group();
    faceGroup.position.set(0, 0.1, 0.98);
    faceGroup.renderOrder = 999;
    headGroup.add(faceGroup);

    // 3D LED Eye Arches ^ ^ (Left & Right - Matching Image 2!)
    const eyeArcGeo = new THREE.TorusGeometry(0.15, 0.042, 16, 32, Math.PI);
    
    const leftEye = new THREE.Mesh(eyeArcGeo, cyanLedMat);
    leftEye.position.set(-0.32, 0.08, 0);
    leftEye.renderOrder = 999;
    faceGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeArcGeo, cyanLedMat);
    rightEye.position.set(0.32, 0.08, 0);
    rightEye.renderOrder = 999;
    faceGroup.add(rightEye);

    // 3D LED Heart Eyes ♥ ♥ (Love Mode)
    const heartGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const leftHeartEye = new THREE.Mesh(heartGeo, pinkLedMat);
    leftHeartEye.position.set(-0.32, 0.08, 0);
    leftHeartEye.renderOrder = 999;
    leftHeartEye.visible = false;
    faceGroup.add(leftHeartEye);

    const rightHeartEye = new THREE.Mesh(heartGeo, pinkLedMat);
    rightHeartEye.position.set(0.32, 0.08, 0);
    rightHeartEye.renderOrder = 999;
    rightHeartEye.visible = false;
    faceGroup.add(rightHeartEye);

    // 3D LED Smile Arc (Matching Image 2!)
    const smileGeo = new THREE.TorusGeometry(0.24, 0.038, 16, 32, Math.PI * 0.85);
    const smileMesh = new THREE.Mesh(smileGeo, cyanLedMat);
    smileMesh.rotation.z = Math.PI;
    smileMesh.position.set(0, -0.22, 0);
    smileMesh.renderOrder = 999;
    faceGroup.add(smileMesh);

    // ====================================================
    // ARTICULATED BODY, CHEST & LIMBS (Exact Match to Image 2)
    // ====================================================
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.45, 0);
    robotGroup.add(torsoGroup);

    // Glossy White Chest Armor Plate
    const chestGeo = new THREE.CylinderGeometry(0.72, 0.55, 0.9, 32);
    const chestMesh = new THREE.Mesh(chestGeo, glossyWhiteMat);
    torsoGroup.add(chestMesh);

    // Glowing Chest Core Reactor Ring
    const coreGeo = new THREE.TorusGeometry(0.16, 0.035, 16, 32);
    const coreMesh = new THREE.Mesh(coreGeo, cyanLedMat);
    coreMesh.position.set(0, 0.12, 0.65);
    torsoGroup.add(coreMesh);

    // --- LEFT ARM (Open Welcoming Pose) ---
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.85, 0.25, 0);
    torsoGroup.add(leftArmGroup);

    const shoulderGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const leftShoulder = new THREE.Mesh(shoulderGeo, darkJointMat);
    leftArmGroup.add(leftShoulder);

    const bicepGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16);
    const leftBicep = new THREE.Mesh(bicepGeo, glossyWhiteMat);
    leftBicep.position.set(-0.18, -0.18, 0.1);
    leftBicep.rotation.z = Math.PI / 4;
    leftArmGroup.add(leftBicep);

    const leftForearm = new THREE.Mesh(bicepGeo, glossyWhiteMat);
    leftForearm.position.set(-0.35, -0.32, 0.25);
    leftForearm.rotation.y = Math.PI / 4;
    leftArmGroup.add(leftForearm);

    // Open Articulated Robot Hand & Fingers
    const handGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const leftHand = new THREE.Mesh(handGeo, glossyWhiteMat);
    leftHand.position.set(-0.5, -0.45, 0.35);
    leftArmGroup.add(leftHand);

    for (let f = 0; f < 5; f++) {
      const fingerGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.12, 8);
      const finger = new THREE.Mesh(fingerGeo, darkJointMat);
      finger.position.set(-0.52 + (f * 0.02), -0.55, 0.35 + (f * 0.03));
      leftArmGroup.add(finger);
    }

    // --- RIGHT ARM ---
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.85, 0.25, 0);
    torsoGroup.add(rightArmGroup);

    const rightShoulder = new THREE.Mesh(shoulderGeo, darkJointMat);
    rightArmGroup.add(rightShoulder);

    const rightBicep = new THREE.Mesh(bicepGeo, glossyWhiteMat);
    rightBicep.position.set(0.18, -0.18, 0);
    rightBicep.rotation.z = -Math.PI / 4;
    rightArmGroup.add(rightBicep);

    const rightHand = new THREE.Mesh(handGeo, glossyWhiteMat);
    rightHand.position.set(0.38, -0.42, 0.1);
    rightArmGroup.add(rightHand);

    for (let f = 0; f < 5; f++) {
      const fingerGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.12, 8);
      const finger = new THREE.Mesh(fingerGeo, darkJointMat);
      finger.position.set(0.36 + (f * 0.02), -0.52, 0.1 + (f * 0.02));
      rightArmGroup.add(finger);
    }

    // --- LEGS & GLOWING CYAN LED FEET SOLES ---
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.38, -0.5, 0);
    torsoGroup.add(leftLegGroup);

    const thighGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.45, 16);
    const leftThigh = new THREE.Mesh(thighGeo, glossyWhiteMat);
    leftLegGroup.add(leftThigh);

    const footGeo = new THREE.BoxGeometry(0.32, 0.16, 0.45);
    const leftFoot = new THREE.Mesh(footGeo, glossyWhiteMat);
    leftFoot.position.set(0, -0.3, 0.1);
    leftLegGroup.add(leftFoot);

    // Glowing Cyan Sole
    const soleGeo = new THREE.BoxGeometry(0.28, 0.035, 0.4);
    const leftSole = new THREE.Mesh(soleGeo, cyanLedMat);
    leftSole.position.set(0, -0.38, 0.1);
    leftLegGroup.add(leftSole);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.38, -0.5, 0);
    torsoGroup.add(rightLegGroup);

    const rightThigh = new THREE.Mesh(thighGeo, glossyWhiteMat);
    rightLegGroup.add(rightThigh);

    const rightFoot = new THREE.Mesh(footGeo, glossyWhiteMat);
    rightFoot.position.set(0, -0.3, 0.1);
    rightLegGroup.add(rightFoot);

    const rightSole = new THREE.Mesh(soleGeo, cyanLedMat);
    rightSole.position.set(0, -0.38, 0.1);
    rightLegGroup.add(rightSole);

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

      // Smooth Head Mouse Tracking
      headGroup.rotation.y += (targetRotY - headGroup.rotation.y) * 0.08;
      headGroup.rotation.x += (targetRotX - headGroup.rotation.x) * 0.08;

      // 3D Eye & Visor Tracking
      faceGroup.position.x = (targetRotY * 0.08);
      faceGroup.position.y = 0.1 + (targetRotX * 0.05);

      // Body Gentle Hovering
      robotGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.06;

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
        cyanLedMat.color.setHSL(partyHue, 1.0, 0.55);

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

        cyanLedMat.color.setHex(0xf59e0b); // Amber LED
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

        cyanLedMat.color.setHex(0xf43f5e);
        leftEye.visible = false;
        rightEye.visible = false;
        leftHeartEye.visible = true;
        rightHeartEye.visible = true;

      } else {
        // DEFAULT HAPPY STATE (Matching Image 2)
        robotGroup.position.x = 0;
        robotGroup.rotation.z = 0;

        leftArmGroup.rotation.z = 0.1;
        rightArmGroup.rotation.z = -0.1;

        cyanLedMat.color.setHex(0x38bdf8); // Cyan
        leftEye.rotation.z = 0;
        rightEye.rotation.z = 0;
        leftEye.visible = true;
        rightEye.visible = true;
        leftHeartEye.visible = false;
        rightHeartEye.visible = false;
      }

      // REAL-TIME LIPS SYNC SPEECH MORPHING
      if (currentlySpeaking) {
        const mouthScale = 0.8 + Math.abs(Math.sin(elapsedTime * 28)) * 1.4;
        smileMesh.scale.y = mouthScale;
        smileMesh.scale.x = 1.0 + Math.cos(elapsedTime * 18) * 0.2;
        headGroup.rotation.z += Math.sin(elapsedTime * 8) * 0.02;
      } else {
        smileMesh.scale.set(1.0, 1.0, 1.0);
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
