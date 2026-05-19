import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function GlobeView({ events, onEventClick, className }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const globeRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // Globe geometry
    const geometry = new THREE.SphereGeometry(5, 64, 64);
    const material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'),
      bumpMap: new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-topology.png'),
      bumpScale: 0.05,
    });

    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);

    // Add event points
    events.forEach(event => {
      const phi = (90 - event.latitude) * (Math.PI / 180);
      const theta = (event.longitude + 180) * (Math.PI / 180);

      const x = -(5.1 * Math.sin(phi) * Math.cos(theta));
      const z = (5.1 * Math.sin(phi) * Math.sin(theta));
      const y = (5.1 * Math.cos(phi));

      const pointGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const pointMaterial = new THREE.MeshBasicMaterial({
        color: event.category === 'person' ? 0xf59e0b : 0x3b82f6
      });
      const point = new THREE.Mesh(pointGeometry, pointMaterial);

      point.position.set(x, y, z);
      point.userData = event;
      scene.add(point);
    });

    camera.position.z = 10;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      globe.rotation.y += 0.005;
      renderer.render(scene, camera);
    };
    animate();

    // Store refs
    sceneRef.current = scene;
    rendererRef.current = renderer;
    globeRef.current = globe;

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [events]);

  return <div ref={mountRef} className={`w-full h-full ${className}`} />;
}
