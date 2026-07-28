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
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 320;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0.25, 6.2);

    // 2. WebGL Renderer with Soft Shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x38bdf8, 2.2); // Cyan key light
    mainLight.position.set(4, 7, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xf472b6, 1.4); // Pink fill light
    fillLight.position.set(-4, 3, 3);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 3, 8);
    rimLight.position.set(0, 3, -3);
    scene.add(rimLight);

    // 4. Robot Master Group
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // 5. Materials (Exact Match to User Image: Glossy White + Dark Visor + Glowing Cyan LED Rim)
    const pearlWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.95,
    });

    const darkJointMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25,
    });

    const darkVisorMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.05,
      transmission: 0.2,
      transparent: true,
      opacity: 0.96,
    });

    const cyanLedMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Glowing Cyan LED Rim & Eyes
    });

    const pinkLedMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, // Loving Heart Pink LED
    });

    const amberLedMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // Sad / Sympathetic Amber
    });

    // --- HEAD GROUP ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.8, 0);
    robotGroup.add(headGroup);

    // Large White Helmet Sphere
    const helmetGeo = new THREE.SphereGeometry(1.0, 32, 32);
    const helmetMesh = new THREE.Mesh(helmetGeo, pearlWhiteMat);
    headGroup.add(helmetMesh);

    // Curved Dark Glass Visor Face Plate
    const visorGeo = new THREE.SphereGeometry(0.85, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const visorMesh = new THREE.Mesh(visorGeo, darkVisorMat);
    visorMesh.rotation.x = Math.PI / 2.2;
    visorMesh.position.set(0, 0.08, 0.2);
    headGroup.add(visorMesh);

    // GLOWING CYAN LED RIM RING (Exact match to reference image!)
    const ledRimGeo = new THREE.TorusGeometry(0.85, 0.035, 16, 64);
    const ledRimMesh = new THREE.Mesh(ledRimGeo, cyanLedMat);
    ledRimMesh.rotation.x = Math.PI / 2.2;
    ledRimMesh.position.set(0, 0.08, 0.2);
    headGroup.add(ledRimMesh);

    // Ear Headphones (Left & Right)
    const earGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 24);
    const leftEar = new THREE.Mesh(earGeo, darkJointMat);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-1.0, 0.05, 0);
    headGroup.add(leftEar);

    const leftEarRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 16, 32), cyanLedMat);
    leftEarRing.rotation.y = Math.PI / 2;
    leftEarRing.position.set(-1.08, 0.05, 0);
    headGroup.add(leftEarRing);

    const rightEar = new THREE.Mesh(earGeo, darkJointMat);
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(1.0, 0.05, 0);
    headGroup.add(rightEar);

    const rightEarRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 16, 32), cyanLedMat);
    rightEarRing.rotation.y = Math.PI / 2;
    rightEarRing.position.set(1.08, 0.05, 0);
    headGroup.add(rightEarRing);

    // --- DIGITAL LED FACE EYES & MOUTH ---
    const faceGroup = new THREE.Group();
    faceGroup.position.set(0, 0.12, 0.96);
    headGroup.add(faceGroup);

    // Happy Cyan Eye Arches (Left & Right) ^ ^
    const happyEyeGeo = new THREE.TorusGeometry(0.14, 0.03, 12, 24, Math.PI);
    
    const leftHappyEye = new THREE.Mesh(happyEyeGeo, cyanLedMat);
    leftHappyEye.position.set(-0.32, 0.08, 0);
    faceGroup.add(leftHappyEye);

    const rightHappyEye = new THREE.Mesh(happyEyeGeo, cyanLedMat);
    rightHappyEye.position.set(0.32, 0.08, 0);
    faceGroup.add(rightHappyEye);

    // Loving Heart Eyes ♥ ♥
    const heartEyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const leftHeartEye = new THREE.Mesh(heartEyeGeo, pinkLedMat);
    leftHeartEye.position.set(-0.32, 0.08, 0);
    leftHeartEye.visible = false;
    faceGroup.add(leftHeartEye);

    const rightHeartEye = new THREE.Mesh(heartEyeGeo, pinkLedMat);
    rightHeartEye.position.set(0.32, 0.08, 0);
    rightHeartEye.visible = false;
    faceGroup.add(rightHeartEye);

    // Dynamic LED Curved Smile / Lips
    const smileGeo = new THREE.TorusGeometry(0.22, 0.03, 12, 24, Math.PI * 0.8);
    const smileMesh = new THREE.Mesh(smileGeo, cyanLedMat);
    smileMesh.rotation.z = Math.PI;
    smileMesh.position.set(0, -0.22, 0);
    faceGroup.add(smileMesh);

    // Organic Lip Meshes (For Speech Morphing)
    const upperLipGeo = new THREE.TorusGeometry(0.18, 0.025, 12, 24, Math.PI);
    const upperLip = new THREE.Mesh(upperLipGeo, cyanLedMat);
    upperLip.rotation.x = Math.PI;
    upperLip.position.set(0, -0.16, 0.02);
    faceGroup.add(upperLip);

    const lowerLipGeo = new THREE.TorusGeometry(0.18, 0.03, 12, 24, Math.PI);
    const lowerLip = new THREE.Mesh(lowerLipGeo, cyanLedMat);
    lowerLip.position.set(0, -0.26, 0.02);
    faceGroup.add(lowerLip);

    // --- CUTE ROBOT TORSO & FULL SKELETAL ARMS / LEGS ---
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.45, 0);
    robotGroup.add(torsoGroup);

    // Glossy White Chest Armor
    const chestGeo = new THREE.CylinderGeometry(0.72, 0.55, 0.9, 32);
    const chestMesh = new THREE.Mesh(chestGeo, pearlWhiteMat);
    torsoGroup.add(chestMesh);

    // Glowing Chest Core Reactor Ring
    const coreGeo = new THREE.TorusGeometry(0.16, 0.03, 16, 32);
    const coreMesh = new THREE.Mesh(coreGeo, cyanLedMat);
    coreMesh.position.set(0, 0.1, 0.65);
    torsoGroup.add(coreMesh);

    // --- LEFT ARM ---
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.85, 0.25, 0);
    torsoGroup.add(leftArmGroup);

    const shoulderGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const leftShoulder = new THREE.Mesh(shoulderGeo, darkJointMat);
    leftArmGroup.add(leftShoulder);

    const bicepGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16);
    const leftBicep = new THREE.Mesh(bicepGeo, pearlWhiteMat);
    leftBicep.position.set(-0.15, -0.2, 0);
    leftBicep.rotation.z = Math.PI / 6;
    leftArmGroup.add(leftBicep);

    const handGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const leftHand = new THREE.Mesh(handGeo, pearlWhiteMat);
    leftHand.position.set(-0.35, -0.42, 0.1);
    leftArmGroup.add(leftHand);

    // --- RIGHT ARM ---
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.85, 0.25, 0);
    torsoGroup.add(rightArmGroup);

    const rightShoulder = new THREE.Mesh(shoulderGeo, darkJointMat);
    rightArmGroup.add(rightShoulder);

    const rightBicep = new THREE.Mesh(bicepGeo, pearlWhiteMat);
    rightBicep.position.set(0.15, -0.2, 0);
    rightBicep.rotation.z = -Math.PI / 6;
    rightArmGroup.add(rightBicep);

    const rightHand = new THREE.Mesh(handGeo, pearlWhiteMat);
    rightHand.position.set(0.35, -0.42, 0.1);
    rightArmGroup.add(rightHand);

    // --- LEGS & GLOWING LED FEET SOLES ---
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.4, -0.5, 0);
    torsoGroup.add(leftLegGroup);

    const thighGeo = new THREE.CylinderGeometry(0.18, 0.15, 0.45, 16);
    const leftThigh = new THREE.Mesh(thighGeo, pearlWhiteMat);
    leftLegGroup.add(leftThigh);

    const footGeo = new THREE.BoxGeometry(0.32, 0.15, 0.45);
    const leftFoot = new THREE.Mesh(footGeo, pearlWhiteMat);
    leftFoot.position.set(0, -0.3, 0.1);
    leftLegGroup.add(leftFoot);

    // Glowing LED Sole
    const soleGeo = new THREE.BoxGeometry(0.28, 0.03, 0.4);
    const leftSole = new THREE.Mesh(soleGeo, cyanLedMat);
    leftSole.position.set(0, -0.38, 0.1);
    leftLegGroup.add(leftSole);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.4, -0.5, 0);
    torsoGroup.add(rightLegGroup);

    const rightThigh = new THREE.Mesh(thighGeo, pearlWhiteMat);
    rightLegGroup.add(rightThigh);

    const rightFoot = new THREE.Mesh(footGeo, pearlWhiteMat);
    rightFoot.position.set(0, -0.3, 0.1);
    rightLegGroup.add(rightFoot);

    const rightSole = new THREE.Mesh(soleGeo, cyanLedMat);
    rightSole.position.set(0, -0.38, 0.1);
    rightLegGroup.add(rightSole);

    // Mouse Tracking setup
    let targetRotX = 0;
    let targetRotY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      const y = -(((event.clientY - rect.top) / container.clientHeight) * 2 - 1);
      targetRotY = Math.max(-0.55, Math.min(0.55, x * 0.45));
      targetRotX = Math.max(-0.35, Math.min(0.35, -y * 0.35));
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let danceAngle = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      const currentlySpeaking = speakingRef.current;
      const currentlyThinking = thinkingRef.current;
      const currentEmotion = emotionRef.current;

      // Smooth Head Tracking
      headGroup.rotation.y += (targetRotY - headGroup.rotation.y) * 0.08;
      headGroup.rotation.x += (targetRotX - headGroup.rotation.x) * 0.08;

      // ----------------------------------------------------
      // EMOTION & DANCE STATE MACHINE
      // ----------------------------------------------------
      if (currentEmotion === 'dance') {
        // DANCE ROUTINE (Hip sways, arm bounces, flashing lights!)
        danceAngle += 0.1;
        robotGroup.position.x = Math.sin(danceAngle * 1.5) * 0.3;
        robotGroup.position.y = Math.abs(Math.cos(danceAngle * 3)) * 0.15;
        robotGroup.rotation.z = Math.sin(danceAngle * 1.5) * 0.12;

        leftArmGroup.rotation.z = Math.sin(danceAngle * 3) * 0.6 + 0.3;
        rightArmGroup.rotation.z = -Math.sin(danceAngle * 3) * 0.6 - 0.3;
        headGroup.rotation.z = Math.sin(danceAngle * 3) * 0.15;

        // Flashing Party Lights
        const partyHue = (Math.sin(elapsedTime * 6) + 1) / 2;
        cyanLedMat.color.setHSL(partyHue, 1.0, 0.55);
        ledRimMesh.scale.set(1.05, 1.05, 1.05);

        // Dancing Eyes > <
        leftHappyEye.visible = true;
        rightHappyEye.visible = true;
        leftHeartEye.visible = false;
        rightHeartEye.visible = false;
        smileMesh.rotation.z = 0; // W-smile

      } else if (currentEmotion === 'sad') {
        // SYMPATHETIC / SAD STATE (Comforting drooped eyes, warm amber glow, gentle embrace)
        robotGroup.position.x = 0;
        robotGroup.position.y = Math.sin(elapsedTime * 1.5) * 0.03;
        robotGroup.rotation.z = 0;

        headGroup.rotation.z = -0.15; // Sympathetic head tilt
        leftArmGroup.rotation.z = 0.4;
        rightArmGroup.rotation.z = -0.4;
        leftArmGroup.position.z = 0.2; // Bringing hands to heart in warm hug
        rightArmGroup.position.z = 0.2;

        // Amber Sympathetic LED Glow
        cyanLedMat.color.setHex(0xf59e0b);
        leftHappyEye.rotation.z = Math.PI; // Downturned sad eyes u u
        rightHappyEye.rotation.z = Math.PI;
        leftHappyEye.visible = true;
        rightHappyEye.visible = true;
        leftHeartEye.visible = false;
        rightHeartEye.visible = false;

      } else if (currentEmotion === 'love') {
        // LOVING / BEST FRIEND STATE (Heart eyes ♥ ♥, warm pink glow, enthusiastic waving!)
        robotGroup.position.x = 0;
        robotGroup.position.y = Math.sin(elapsedTime * 2.5) * 0.08;
        robotGroup.rotation.z = Math.sin(elapsedTime * 2) * 0.05;

        leftArmGroup.rotation.z = 0.8 + Math.sin(elapsedTime * 5) * 0.2; // Waving hand
        rightArmGroup.rotation.z = -0.8 - Math.sin(elapsedTime * 5) * 0.2;

        cyanLedMat.color.setHex(0xf43f5e); // Soft Rose Pink Glow
        leftHappyEye.visible = false;
        rightHappyEye.visible = false;
        leftHeartEye.visible = true;
        rightHeartEye.visible = true;

      } else {
        // DEFAULT HAPPY / MENTOR STATE
        robotGroup.position.x = 0;
        robotGroup.position.y = Math.sin(elapsedTime * 2.0) * 0.06;
        robotGroup.rotation.z = 0;

        leftArmGroup.rotation.z = 0.1;
        rightArmGroup.rotation.z = -0.1;
        rightArmGroup.rotation.x = Math.sin(elapsedTime * 2) * 0.1;

        cyanLedMat.color.setHex(0x38bdf8); // Cyan
        leftHappyEye.rotation.z = 0;
        rightHappyEye.rotation.z = 0;
        leftHappyEye.visible = true;
        rightHappyEye.visible = true;
        leftHeartEye.visible = false;
        rightHeartEye.visible = false;
      }

      // REAL-TIME VISME LIP SYNC
      if (currentlySpeaking) {
        const mouthValue = Math.max(0.04, (Math.sin(elapsedTime * 30) * 0.5 + Math.cos(elapsedTime * 18) * 0.3 + 0.4) * 0.09);
        upperLip.position.y = -0.16 + mouthValue;
        lowerLip.position.y = -0.26 - mouthValue * 1.5;
        smileMesh.scale.y = 1.0 + mouthValue * 3.0;
      } else {
        upperLip.position.y = -0.16;
        lowerLip.position.y = -0.26;
        smileMesh.scale.y = 1.0;
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
      className="w-full h-full min-h-[280px] max-h-[350px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none" 
    />
  );
};
