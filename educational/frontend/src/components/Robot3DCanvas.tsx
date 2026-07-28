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
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 320;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 0.3, 5.6);

    // 2. WebGL Renderer with High Quality Shadows & Antialiasing
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Warm Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x60a5fa, 2.0); // Friendly blue key light
    mainLight.position.set(4, 7, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xf472b6, 1.3); // Warm pink side light
    fillLight.position.set(-4, 3, 3);
    scene.add(fillLight);

    const backLight = new THREE.PointLight(0x38bdf8, 2.5, 6);
    backLight.position.set(0, 2, -3);
    scene.add(backLight);

    // 4. Robot 3D Group
    const robotGroup = new THREE.Group();
    scene.add(robotGroup);

    // 5. Materials
    const pearlSkinMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.9,
    });

    const softBlueAccentMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.3,
      roughness: 0.2,
    });

    const cuteEyeMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
    });

    const eyeHighlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    const rosyCheekMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.5,
    });

    const lipMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf43f5e, // Glossy coral rose lips
      metalness: 0.2,
      roughness: 0.2,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });

    const innerMouthMat = new THREE.MeshBasicMaterial({
      color: 0x881337,
    });

    // --- HEAD GROUP ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.75, 0);
    robotGroup.add(headGroup);

    // Rounded Friendly Head
    const headGeo = new THREE.SphereGeometry(0.95, 32, 32);
    const headMesh = new THREE.Mesh(headGeo, pearlSkinMat);
    headGroup.add(headMesh);

    // Cute Soft Ear Buds (Left & Right)
    const earGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const leftEar = new THREE.Mesh(earGeo, softBlueAccentMat);
    leftEar.position.set(-0.95, 0.05, 0);
    headGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, softBlueAccentMat);
    rightEar.position.set(0.95, 0.05, 0);
    headGroup.add(rightEar);

    // Cute Eyebrows (Left & Right)
    const browGeo = new THREE.TorusGeometry(0.16, 0.025, 8, 16, Math.PI * 0.7);
    const leftBrow = new THREE.Mesh(browGeo, softBlueAccentMat);
    leftBrow.rotation.z = -Math.PI / 8;
    leftBrow.position.set(-0.32, 0.38, 0.86);
    headGroup.add(leftBrow);

    const rightBrow = new THREE.Mesh(browGeo, softBlueAccentMat);
    rightBrow.rotation.z = Math.PI / 8;
    rightBrow.position.set(0.32, 0.38, 0.86);
    headGroup.add(rightBrow);

    // Big Friendly Eye Sockets
    const eyeSocketGeo = new THREE.SphereGeometry(0.22, 32, 16);
    
    // Left Eye
    const leftEye = new THREE.Mesh(eyeSocketGeo, cuteEyeMat);
    leftEye.position.set(-0.32, 0.16, 0.85);
    headGroup.add(leftEye);

    const leftSparkle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeHighlightMat);
    leftSparkle.position.set(-0.28, 0.22, 1.04);
    headGroup.add(leftSparkle);

    // Right Eye
    const rightEye = new THREE.Mesh(eyeSocketGeo, cuteEyeMat);
    rightEye.position.set(0.32, 0.16, 0.85);
    headGroup.add(rightEye);

    const rightSparkle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeHighlightMat);
    rightSparkle.position.set(0.36, 0.22, 1.04);
    headGroup.add(rightSparkle);

    // Cute Rosy Cheeks
    const cheekGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const leftCheek = new THREE.Mesh(cheekGeo, rosyCheekMat);
    leftCheek.position.set(-0.52, -0.08, 0.82);
    headGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, rosyCheekMat);
    rightCheek.position.set(0.52, -0.08, 0.82);
    headGroup.add(rightCheek);

    // --- ORGANIC 3D LIPS & MOUTH CAVITY ---
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.25, 0.82);
    headGroup.add(mouthGroup);

    // Dark Inner Mouth Cavity
    const cavityGeo = new THREE.SphereGeometry(0.2, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const cavityMesh = new THREE.Mesh(cavityGeo, innerMouthMat);
    cavityMesh.rotation.x = Math.PI / 2;
    cavityMesh.position.set(0, -0.02, -0.02);
    cavityMesh.scale.set(1, 0.4, 0.5);
    mouthGroup.add(cavityMesh);

    // 3D Upper Lip Mesh (Curved Arc)
    const upperLipGeo = new THREE.TorusGeometry(0.2, 0.038, 16, 32, Math.PI);
    const upperLip = new THREE.Mesh(upperLipGeo, lipMaterial);
    upperLip.rotation.x = Math.PI;
    upperLip.position.set(0, 0.04, 0.05);
    mouthGroup.add(upperLip);

    // 3D Lower Lip Mesh (Curved Arc)
    const lowerLipGeo = new THREE.TorusGeometry(0.2, 0.045, 16, 32, Math.PI);
    const lowerLip = new THREE.Mesh(lowerLipGeo, lipMaterial);
    lowerLip.position.set(0, -0.04, 0.05);
    mouthGroup.add(lowerLip);

    // Friendly Graduation Cap / Antenna Top
    const capBaseGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 32);
    const capMesh = new THREE.Mesh(capBaseGeo, softBlueAccentMat);
    capMesh.position.set(0, 0.96, 0);
    headGroup.add(capMesh);

    const antTipGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const antTipMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const antTip = new THREE.Mesh(antTipGeo, antTipMat);
    antTip.position.set(0, 1.22, 0);
    headGroup.add(antTip);

    // --- CUTE ROBOT TORSO & HANDS ---
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, -0.5, 0);
    robotGroup.add(torsoGroup);

    // Rounded Friendly Torso
    const torsoGeo = new THREE.CylinderGeometry(0.72, 0.52, 1.0, 32);
    const torsoMesh = new THREE.Mesh(torsoGeo, pearlSkinMat);
    torsoGroup.add(torsoMesh);

    // Heart / Star Chest Light
    const heartGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const heartMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const heartMesh = new THREE.Mesh(heartGeo, heartMat);
    heartMesh.position.set(0, 0.12, 0.65);
    torsoGroup.add(heartMesh);

    // Waving Hand Spheres
    const handGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const leftHand = new THREE.Mesh(handGeo, softBlueAccentMat);
    leftHand.position.set(-0.85, 0.1, 0.2);
    torsoGroup.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, softBlueAccentMat);
    rightHand.position.set(0.85, 0.1, 0.2);
    torsoGroup.add(rightHand);

    // Floating Halo Ring
    const haloGeo = new THREE.TorusGeometry(1.4, 0.015, 16, 64);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4 });
    const haloRing = new THREE.Mesh(haloGeo, haloMat);
    haloRing.rotation.x = Math.PI / 2.3;
    robotGroup.add(haloRing);

    // Mouse Pointer Head Tracking Setup
    let targetRotX = 0;
    let targetRotY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
      const y = -(((event.clientY - rect.top) / container.clientHeight) * 2 - 1);
      targetRotY = Math.max(-0.5, Math.min(0.5, x * 0.45));
      targetRotX = Math.max(-0.3, Math.min(0.3, -y * 0.3));
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let blinkTimer = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth Head Mouse Tracking
      headGroup.rotation.y += (targetRotY - headGroup.rotation.y) * 0.08;
      headGroup.rotation.x += (targetRotX - headGroup.rotation.x) * 0.08;

      // Friendly Floating Motion
      robotGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.06;
      haloRing.rotation.z = elapsedTime * 0.4;
      rightHand.position.y = 0.1 + Math.sin(elapsedTime * 4) * 0.08;

      const currentlySpeaking = speakingRef.current;
      const currentlyThinking = thinkingRef.current;

      // REAL-TIME LIP SYNC & ORGANIC VISME LIPS ANIMATION
      if (currentlySpeaking) {
        // Multi-frequency harmonic mouth oscillation for natural speech visemes (A, E, I, O, U)
        const mouthOpenValue = Math.max(0.08, (Math.sin(elapsedTime * 30) * 0.5 + Math.cos(elapsedTime * 18) * 0.3 + 0.45) * 0.12);
        
        // Upper Lip moves UP slightly
        upperLip.position.y = 0.04 + mouthOpenValue * 0.4;
        
        // Lower Lip moves DOWN dynamically
        lowerLip.position.y = -0.04 - mouthOpenValue * 0.9;
        
        // Inner Cavity expands with speech
        cavityMesh.scale.set(1.0 + mouthOpenValue * 1.5, 0.4 + mouthOpenValue * 3.0, 0.5);

        // Friendly Eyebrows expressively bounce while talking
        leftBrow.position.y = 0.38 + Math.sin(elapsedTime * 12) * 0.03;
        rightBrow.position.y = 0.38 + Math.sin(elapsedTime * 12) * 0.03;

        // Pulse Heart Light
        heartMat.color.setHSL(0.55 + Math.sin(elapsedTime * 10) * 0.1, 0.9, 0.6);
        antTipMat.color.setHex(0x38bdf8);
      } else if (currentlyThinking) {
        upperLip.position.y = 0.04;
        lowerLip.position.y = -0.04;
        cavityMesh.scale.set(1, 0.4, 0.5);
        heartMat.color.setHex(0xc084fc);
        antTipMat.color.setHex(0xa855f7);
        leftBrow.rotation.z = -Math.PI / 12;
        rightBrow.rotation.z = Math.PI / 6;
      } else {
        // Idle State: Cute Smile
        upperLip.position.y = 0.04;
        lowerLip.position.y = -0.04;
        cavityMesh.scale.set(1, 0.4, 0.5);
        heartMat.color.setHex(0x38bdf8);
        antTipMat.color.setHex(0x3b82f6);
        leftBrow.rotation.z = -Math.PI / 8;
        rightBrow.rotation.z = Math.PI / 8;
        leftBrow.position.y = 0.38;
        rightBrow.position.y = 0.38;
      }

      // Natural Blink Animation (Every 3.6 Seconds)
      blinkTimer += 0.016;
      if (blinkTimer > 3.6 && blinkTimer < 3.75) {
        leftEye.scale.y = 0.08;
        rightEye.scale.y = 0.08;
        leftSparkle.visible = false;
        rightSparkle.visible = false;
      } else {
        leftEye.scale.y = 1.0;
        rightEye.scale.y = 1.0;
        leftSparkle.visible = true;
        rightSparkle.visible = true;
        if (blinkTimer > 3.8) blinkTimer = 0;
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
      className="w-full h-full min-h-[260px] max-h-[340px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none" 
    />
  );
};
