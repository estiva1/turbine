import gsap from "gsap";
import { Howl } from "howler";
import * as THREE from "three";
import { CustomEase } from "gsap/all";
import { MathUtils, RectAreaLight } from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { useFrame as useRaf } from "@darkroom.engineering/hamo";
import { Bloom, EffectComposer, FXAA } from "@react-three/postprocessing";
import { OrbitControls, Preload, useGLTF } from "@react-three/drei";
import { RectAreaLightHelper, RectAreaLightUniformsLib } from "three/examples/jsm/Addons.js";
import { forwardRef, memo, Suspense, useCallback, useEffect, useRef, useState } from "react";

import whoosh from "../assets/woosh.mp3";
import turbine from "../models/Location.glb";
import backgroundWide from "../assets/background-wide.jpg";

import WaterSurfaceSimple from "../WaterSurface/WaterSurfaceSimple";
import RotatingBackground from "../RotatingBackground/RotatingBackground";

import { Stats } from "../lib/stats/stats";

gsap.registerPlugin(CustomEase);
THREE.ColorManagement.enabled = true;

// Expensive af, aviod it at all cost
const RectArealightWithHelper = forwardRef(({ position, color, intensity, rotation }, ref) => {
  const { scene } = useThree();

  useEffect(() => {
    RectAreaLightUniformsLib.init();

    const rectLight = new RectAreaLight(color, intensity, 400, 400);
    if (ref) ref.current = rectLight; // Attach the light to the ref

    rectLight.position.set(position[0], position[1], position[2]);
    rectLight.rotation.set(MathUtils.degToRad(rotation[0]), MathUtils.degToRad(rotation[1]), MathUtils.degToRad(rotation[2]));

    scene.add(rectLight);

    const rectLightHelper = new RectAreaLightHelper(rectLight);
    rectLight.add(rectLightHelper);

    // Cleanup
    return () => {
      rectLight.remove(rectLightHelper);
      scene.remove(rectLight);
      rectLight.dispose();
      rectLightHelper.dispose();
    };
  }, [color, intensity, position, rotation, scene]);

  return null;
});

const logSceneStructure = (object, depth = 0) => {
  console.log(`${" ".repeat(depth * 2)}${object.name}`);
  object.children.forEach(child => logSceneStructure(child, depth + 1));
};

const Turbine = ({ rotationSpeedRef, bladeLightIntensityRef, farmingAllowed, startAnimation, onLoaded }) => {
  const { camera } = useThree();
  const { scene: turbine_model } = useGLTF(turbine);

  const [sceneState, setSceneState] = useState({
    camera: {
      position: {
        init: 53.84,
        target: 47,
      },
    },
    envLights: {
      rectArealight: {
        intensity: {
          init: 0,
          target: 5,
        },
      },
      directionalLight: {
        intensity: {
          init: 0.82,
          target: 3,
        },
        position: {
          init: [374, 165, -150],
          target: [374, 165, -5],
        },
      },
    },
    bladeLights: {
      innerBladeLights: {
        emissiveColor: {
          red: "#ff1f1f",
          green: "#99ff00",
          init: "#000000",
        },
        emissiveIntensity: {
          red: 18,
          green: 2.5,
        },
      },
      outerBladeLights: {
        emissiveColor: {
          red: "#ff1f1f",
          green: "#99ff00",
          init: "#000000",
        },
        emissiveIntensity: {
          red: 18,
          green: 2.5,
        },
      },
    },
    bloom: {
      intensity: {
        init: 0,
        target: 1,
      },
    },
  });

  const sound = new Howl({
    src: [whoosh],
    loop: false,
    volume: 0.05,
    rate: 0.35,
  });

  const segments = 3;
  let targetRotation = 0;
  let lastTriggeredSegment = -1;
  let isAnimatingToTarget = false;
  const fullRotation = Math.PI * 2;
  const segmentAngle = (Math.PI * 2) / segments;

  const debounceValueForLights = 1.5;
  const targetEmissiveIntensityRed = 18;
  const targetEmissiveIntensityGreen = 2.5;

  //---Scene states
  const [cameraPosition, setCameraPosition] = useState(sceneState.camera.position.init);
  const [rectArealightIntensity, setRectArealightIntensity] = useState(sceneState.envLights.rectArealight.intensity.init);
  const [directionalLightPosition, setDirectionalLightPosition] = useState(sceneState.envLights.directionalLight.position.init);
  const [directionalLightIntensity, setDirectionalLightIntensity] = useState(sceneState.envLights.directionalLight.intensity.init);

  const [bloomIntensity, setBloomIntensity] = useState(sceneState.bloom.intensity.init);
  const [emissiveIntensity, setEmissiveIntensity] = useState(bladeLightIntensityRef.current);
  const [innerBladeLightsColor, setInnerBladeLightsColor] = useState(sceneState.bladeLights.innerBladeLights.emissiveColor.init);
  const [outerBladeLightsColor, setOuterBladeLightsColor] = useState(sceneState.bladeLights.outerBladeLights.emissiveColor.init);

  const [notInteracting, setNotInteracting] = useState(false);
  const [constantRotationEnabled, setConstantRotationEnabled] = useState(false);

  //---Light Refs
  const bloomRef = useRef(null);
  const rectArealightRef = useRef(null);
  const directionalLightRef = useRef(null);

  //---Model Refs
  const innerLights = useRef([]);
  const outerLights = useRef([]);
  const bladesRef = useRef(null);
  const turbineRef = useRef(null);
  const blinkingRef = useRef(false);

  const turbineMaterial = new THREE.MeshStandardMaterial({
    color: "#bcbcbc",
    metalness: 0.18,
    roughness: 0.71,
  });
  const innerLightMaterial = new THREE.MeshStandardMaterial({
    color: "#bcbcbc",
    metalness: 0.18,
    roughness: 0.71,
    emissive: new THREE.Color(innerBladeLightsColor),
    emissiveIntensity: emissiveIntensity,
  });
  const outerLightMaterial = new THREE.MeshStandardMaterial({
    color: "#bcbcbc",
    metalness: 0.18,
    roughness: 0.71,
    emissive: new THREE.Color(outerBladeLightsColor),
    emissiveIntensity: emissiveIntensity,
  });

  // Leva fine-tuning, do not delete

  // const [{ turbineMetalness, turbineRoughness }] = useControls(
  //   "Turbine",
  //   () => ({
  //     turbineMetalness: {
  //       min: 0,
  //       value: 0.18,
  //       max: 1,
  //     },
  //     turbineRoughness: {
  //       min: 0,
  //       value: 0.71,
  //       max: 1,
  //     },
  //   }),
  //   []
  // );

  // useEffect(() => {
  //   turbineMaterial.metalness = turbineMetalness;
  //   turbineMaterial.roughness = turbineRoughness;
  // }, [turbineMetalness, turbineRoughness, turbineMaterial]);

  useEffect(() => {
    if (startAnimation) {
      camera.position.z = cameraPosition;
      camera.lookAt(0, 0, 0);
      // console.log('RERENDER OCCURED')
    }
  }, [startAnimation]);

  useEffect(() => {
    if (turbine_model) {
      //logSceneStructure(turbine_model);

      const turbine = turbine_model.getObjectByName("Windmill_V21");

      turbine_model.traverse(node => {
        node.material = turbineMaterial;

        const bladesGroup = turbine.getObjectByName("Wings");
        if (bladesGroup) {
          bladesRef.current = bladesGroup;

          const bladesGroupInner = bladesGroup.getObjectByName("Wings_1");
          if (bladesGroupInner) {
            bladesGroupInner.children.forEach(blade => {
              blade.children.forEach(mesh => {
                if (mesh.name.startsWith("Wing_Base")) {
                  mesh.children.forEach((childNode, index) => {
                    if (index === 0) {
                      outerLights.current[index] = childNode;
                      childNode.material = outerLightMaterial;
                    } else if (index === 1) {
                      innerLights.current[index] = childNode;
                      childNode.material = innerLightMaterial;
                    }
                  });
                }
              });
            });
          }
        }
      });

      //---Horizon bloom
      const plane2Mesh = turbine_model.getObjectByName("Plane1");
      if (plane2Mesh) {
        const gradientMaterial = new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color("#2bc6ff") },
            uRadius: { value: 0.5 },
            uIntensity: { value: 7.5 },
          },
          vertexShader: `
						varying vec2 vUv;
						void main() {
							vUv = uv;
							gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
						}
					`,
          fragmentShader: `
						varying vec2 vUv;
						uniform vec3 uColor;
						uniform float uRadius;
						uniform float uIntensity;
						
						void main() {
							// Calculate the distance from the center of the UV space (0.5, 0.5)
							float dist = distance(vUv, vec2(0.5));
							
							// Create a smooth gradient from the center to the edges
							float alpha = smoothstep(0.0, uRadius, dist);
							
							// Apply intensity to the color
							vec3 intenseColor = uColor * uIntensity;
							
							// Output the intensified color with alpha
							gl_FragColor = vec4(intenseColor, 1.0 - alpha);
						}
					`,
          transparent: true,
        });

        plane2Mesh.scale.set(0.6, 0.8, 0.4);
        plane2Mesh.material = gradientMaterial;
        plane2Mesh.position.set(0, -136, -94);
      }

      //---Horizon stripe
      const plane3Mesh = turbine_model.getObjectByName("Plane");
      if (plane3Mesh) {
        const gradientMaterial = new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color("#A7C6C5") },
            uRadius: { value: 0.5 },
            uIntensity: { value: 1.8 },
          },
          vertexShader: `
						varying vec2 vUv;
						void main() {
							vUv = uv;
							gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
						}
					`,
          fragmentShader: `
						varying vec2 vUv;
						uniform vec3 uColor;
						uniform float uRadius;
						uniform float uIntensity;
						
						void main() {
							// Calculate the distance from the center of the UV space (0.5, 0.5)
							float dist = distance(vUv, vec2(0.5));
							
							// Create a smooth gradient from the center to the edges
							float alpha = smoothstep(0.0, uRadius, dist);
							
							// Apply intensity to the color
							vec3 intenseColor = uColor * uIntensity;
							
							// Output the intensified color with alpha
							gl_FragColor = vec4(intenseColor, 1.0 - alpha);
						}
					`,
          transparent: true,
        });

        plane3Mesh.scale.set(0.11, 0.6, 0.01);
        plane3Mesh.material = gradientMaterial;
        plane3Mesh.position.set(0, -20.68, -99);
      }
    }

    if (onLoaded) onLoaded();
  }, [turbine_model, turbineMaterial]);

  const lerp = (x, y, t) => {
    return (1 - t) * x + t * y;
  };
  const clamp = (min, input, max) => {
    return Math.max(min, Math.min(input, max));
  };

  const playbackRate = Math.min(Math.max(rotationSpeedRef.current / 0.1, 0.35), 3);
  const minRate = 0.35;
  const maxRate = 3;
  const minVolume = 0.05;
  const maxVolume = 0.6;
  const volume = ((playbackRate - minRate) / (maxRate - minRate)) * (maxVolume - minVolume) + minVolume;

  useRaf((time, deltaTime) => {
    const normalizedDelta = deltaTime / (1000 / 60); // Scale deltaTime relative to 60 FPS

    if (farmingAllowed) {
      if (constantRotationEnabled) {
        const currentRotation = bladesRef.current.rotation.x;
        const newRotation = currentRotation - rotationSpeedRef.current * normalizedDelta;

        // Normalize the rotation to be within 0 to fullRotation
        const normalizedRotation = ((newRotation % fullRotation) + fullRotation) % fullRotation;

        // Calculate the current segment
        const currentSegment = -Math.floor(normalizedRotation / segmentAngle);

        if (currentSegment !== lastTriggeredSegment) {
          lastTriggeredSegment = currentSegment;

          sound.rate(playbackRate);
          sound.volume(volume);
          sound.play();
          if (Math.abs(bladeLightIntensityRef.current - emissiveIntensity) > debounceValueForLights) {
            setEmissiveIntensity(bladeLightIntensityRef.current);
          }
        }

        // Update blade rotation
        bladesRef.current.rotation.x = newRotation;
      }
    } else if (!farmingAllowed && !isAnimatingToTarget) {
      // Normalize the current rotation to be within 0 to fullRotation
      const normalizedRotation = ((bladesRef.current.rotation.x % fullRotation) + fullRotation) % fullRotation;

      // Calculate the target rotation to align the top blade vertically
      targetRotation = Math.round(normalizedRotation / segmentAngle) * segmentAngle;

      // If the target rotation is not the same as the current rotation, start animating
      if (targetRotation !== normalizedRotation) {
        isAnimatingToTarget = true;
      }
    } else if (isAnimatingToTarget) {
      // Normalize the current rotation to be within 0 to fullRotation
      const normalizedRotation = ((bladesRef.current.rotation.x % fullRotation) + fullRotation) % fullRotation;

      // Calculate the delta rotation to the target
      let deltaRotation = targetRotation - normalizedRotation;

      // Handle the case where the shortest path might be in the opposite direction
      if (deltaRotation > Math.PI) {
        deltaRotation -= fullRotation;
      } else if (deltaRotation < -Math.PI) {
        deltaRotation += fullRotation;
      }

      // If the delta is very small, snap to the target rotation
      if (Math.abs(deltaRotation) < 0.01) {
        bladesRef.current.rotation.x = targetRotation;
        isAnimatingToTarget = false;
      } else {
        bladesRef.current.rotation.x += deltaRotation * 0.1; // Adjust the 0.1 for speed of animation
      }
    }

    if (!farmingAllowed) {
      const blinkDuration = 830;
      const isBlinkPhase = Math.floor(time % (blinkDuration * 2)) < blinkDuration;

      if (isBlinkPhase && !blinkingRef.current) {
        blinkingRef.current = true;
        enableRedOuterBladeLights();
      } else if (!isBlinkPhase && blinkingRef.current) {
        blinkingRef.current = false;
      }
    }
  });

  useEffect(() => {
    if (!farmingAllowed) {
      return;
    }

    let timer;
    let decayInterval;

    const handleInteraction = () => {
      setNotInteracting(true);
      // console.log('INTERACTING: ', notInteracting)

      clearTimeout(timer);
      clearInterval(decayInterval);

      timer = setTimeout(() => {
        if (notInteracting) {
          // console.log('NO INTERACTION')

          decayInterval = setInterval(() => {
            if (rotationSpeedRef.current > 0.01 || bladeLightIntensityRef.current > targetEmissiveIntensityGreen) {
              // console.log('COOLDOWN')
              rotationSpeedRef.current = Math.max(rotationSpeedRef.current - 0.001, 0.01);
              bladeLightIntensityRef.current = Math.max(bladeLightIntensityRef.current - 0.175, targetEmissiveIntensityGreen);

              // Debounce
              if (Math.abs(bladeLightIntensityRef.current - emissiveIntensity) > debounceValueForLights) {
                outerLightMaterial.emissive.set(bladeLightIntensityRef.current);
                innerLightMaterial.emissive.set(bladeLightIntensityRef.current);
              }
            } else {
              // console.log('COOLDOWN FINISHED')
              setNotInteracting(false);
              clearInterval(decayInterval);
              rotationSpeedRef.current > 0.01 ? (rotationSpeedRef.current = 0.1) : rotationSpeedRef.current;
            }
          }, 100);
        }
      }, 1000);
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);

    return () => {
      // console.log('COOLDOWN FINISHED')
      setEmissiveIntensity(2.5);
      clearTimeout(timer);
      clearInterval(decayInterval);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    };
  }, [notInteracting, farmingAllowed]);

  // One-time effects here
  useEffect(() => {
    if (!farmingAllowed) {
      shiftCamera(sceneState.camera.position.init);
      switchEnvLights(
        sceneState.envLights.directionalLight.position.init,
        sceneState.envLights.directionalLight.intensity.init,
        sceneState.envLights.rectArealight.intensity.init
      );
      switchInnerBladeLights(sceneState.bladeLights.innerBladeLights.emissiveColor.init);
      switchOuterBladeLights(sceneState.bladeLights.outerBladeLights.emissiveColor.init);
      setConstantRotationEnabled(false);
    } else if (farmingAllowed) {
      shiftCamera(sceneState.camera.position.target);
      switchEnvLights(
        sceneState.envLights.directionalLight.position.target,
        sceneState.envLights.directionalLight.intensity.target,
        sceneState.envLights.rectArealight.intensity.target
      );
      switchInnerBladeLights(sceneState.bladeLights.innerBladeLights.emissiveColor.green);
      switchOuterBladeLights(sceneState.bladeLights.outerBladeLights.emissiveColor.green);
      setTimeout(() => {
        setConstantRotationEnabled(true);
      }, 1100);
    }
  }, [farmingAllowed]);

  // Animations
  const enableRedOuterBladeLights = () => {
    const tl = gsap.timeline();
    const updateColor = new THREE.Color();

    emissiveIntensity === targetEmissiveIntensityRed ? null : setEmissiveIntensity(targetEmissiveIntensityRed);

    const animationTargets = {
      emissive: { color: outerBladeLightsColor },
      bloom: bloomRef.current,
    };

    tl.to(animationTargets.emissive, {
      color: sceneState.bladeLights.outerBladeLights.emissiveColor.red,
      duration: 0.415,
      repeat: 1,
      repeatDelay: 0.415,
      yoyo: true,
      ease: "power3.inOut",
      //ease: CustomEase.create("custom", "M0,0 C0.29,0 0.355,-0.007 0.426,0.077 0.495,0.16 0.481,0.362 0.513,0.502 0.533,0.592 0.516,0.818 0.579,0.912 0.654,1.023 0.704,1 1,1 "),
      onUpdate: function () {
        updateColor.set(this.targets()[0].color);
        outerLightMaterial.emissive.set(updateColor);
      },
    });

    tl.to(
      animationTargets.bloom,
      {
        intensity: sceneState.bloom.intensity.target,
        duration: 0.83,
        repeat: 1,
        yoyo: true,
        ease: "power1.inOut",
      },
      0
    );

    return tl;
  };

  const switchInnerBladeLights = targetColor => {
    const tl = gsap.timeline();
    const updateColor = new THREE.Color();

    emissiveIntensity === targetEmissiveIntensityGreen ? null : setEmissiveIntensity(targetEmissiveIntensityGreen);

    const animationTargets = {
      emissive: { color: innerBladeLightsColor },
    };

    tl.to(animationTargets.emissive, {
      color: targetColor,
      duration: 0.2,
      ease: "power1.inOut",
      onUpdate: function () {
        updateColor.set(this.targets()[0].color);
        innerLightMaterial.emissive.set(updateColor);
      },
      onComplete: () => {
        setInnerBladeLightsColor(targetColor);
      },
    });
  };

  const switchOuterBladeLights = targetColor => {
    const tl = gsap.timeline();
    const updateColor = new THREE.Color();

    emissiveIntensity === targetEmissiveIntensityGreen ? null : setEmissiveIntensity(targetEmissiveIntensityGreen);

    const animationTargets = {
      emissive: { color: outerBladeLightsColor },
      bloom: bloomRef.current,
    };

    tl.to(animationTargets.emissive, {
      color: targetColor,
      duration: 0.83,
      ease: "power1.inOut",
      onUpdate: function () {
        updateColor.set(this.targets()[0].color);
        outerLightMaterial.emissive.set(updateColor);
      },
      onComplete: () => {
        setOuterBladeLightsColor(targetColor);
      },
    });
    tl.to(
      animationTargets.bloom,
      {
        intensity: sceneState.bloom.intensity.target,
        duration: 0.83,
        ease: "power1.inOut",
        onComplete: () => {
          setBloomIntensity(sceneState.bloom.intensity.target);
        },
      },
      0
    );
  };

  const switchEnvLights = (directionalLightPositionTarget, directionalLightIntensityTarget, rectArealightIntensityTarget) => {
    if (directionalLightRef.current) {
      gsap.to(directionalLightRef.current, {
        intensity: directionalLightIntensityTarget,
        duration: 0.83,
        ease: "power1.inOut",
        onUpdate: function () {
          setDirectionalLightIntensity(this.targets()[0].intensity);
        },
      });
      gsap.to(directionalLightRef.current.position, {
        x: directionalLightPositionTarget[0],
        y: directionalLightPositionTarget[1],
        z: directionalLightPositionTarget[2],
        duration: 0.83,
        ease: "power1.inOut",
        // onUpdate: () => {
        //   const light = directionalLightRef.current;
        //   if (light) {
        //     // Update state progressively during the animation
        //     setDirectionalLightVioletInitPos([light.position.x, light.position.y, light.position.z]);
        //   }
        // },
        onComplete: () => {
          setDirectionalLightPosition([
            directionalLightPositionTarget[0],
            directionalLightPositionTarget[1],
            directionalLightPositionTarget[2],
          ]);
        },
      });
    }

    if (rectArealightRef.current) {
      gsap.to(rectArealightRef.current, {
        intensity: rectArealightIntensityTarget,
        duration: 0.83,
        ease: "power1.inOut",
        onUpdate: function () {
          setRectArealightIntensity(this.targets()[0].intensity);
        },
      });
    }
  };

  const shiftCamera = targetPosition => {
    gsap.to(camera.position, {
      z: targetPosition,
      duration: 1.2,
      ease: "power1.out",
      onUpdate: () => {
        camera.lookAt(0, 0, 0);
      },
      onComplete: () => {
        setCameraPosition(targetPosition);
      },
    });
  };

  return (
    <>
      <RectArealightWithHelper
        ref={rectArealightRef}
        color='#ffffff'
        intensity={rectArealightIntensity}
        position={[-183, 152, 268]}
        rotation={[0, -35, 0]}
      />

      <directionalLight
        ref={directionalLightRef}
        position={directionalLightPosition}
        args={[new THREE.Color("#9b00d8"), directionalLightIntensity]}
      />

      <primitive ref={turbineRef} object={turbine_model} scale={[1.1, 1.1, 1.1]} position={[0, 2.85, 5.5]} />
      <EffectComposer multisampling={0} autoClear={true}>
        <FXAA />
        <Bloom
          ref={bloomRef}
          levels={6}
          radius={0.55}
          intensity={bloomIntensity}
          mipmapBlur={true}
          luminanceThreshold={0.7}
          luminanceSmoothing={0.025}
        />
      </EffectComposer>
    </>
  );
};

const TurbineRenderer = ({ farmingAllowed, ...props }) => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isEffectsReady, setIsEffectsReady] = useState(false);
  const [animationsReady, setAnimationsReady] = useState(false);
  const [isActive, setIsActive] = useState(false); // Replacing farmingAllowed with active state

  const rotationSpeedRef = useRef(0.01); // Initial rotation speed
  const bladeLightIntensityRef = useRef(2.5); // Initial intensity

  const maxSpeed = 0.1; // Define max speed
  const maxBladeLightIntensity = 8; // Maximum blade lights brightness intensity
  const stepsToMax = 15; // Number of clicks/taps to max out speed and intensity
  const speedIncrement = (maxSpeed - 0.01) / stepsToMax; // Define speed increment per click
  const bladeLightIntensityIncrement = (maxBladeLightIntensity - 2.5) / stepsToMax; // Increment per click

  const handleModelLoaded = useCallback(() => {
    setIsModelLoaded(true);
  }, []);

  const handleInteraction = () => {
    if (!isActive) return;

    if (rotationSpeedRef.current >= maxSpeed && bladeLightIntensityRef.current >= maxBladeLightIntensity) {
      return;
    }

    rotationSpeedRef.current = Math.min(rotationSpeedRef.current + speedIncrement, maxSpeed);
    bladeLightIntensityRef.current = Math.min(bladeLightIntensityRef.current + bladeLightIntensityIncrement, maxBladeLightIntensity);
  };

  useEffect(() => {
    let animationFrame;
    const checkEffectsReady = () => {
      if (document.querySelector("canvas")) {
        setIsEffectsReady(true);
      } else {
        animationFrame = requestAnimationFrame(checkEffectsReady);
      }
    };

    animationFrame = requestAnimationFrame(checkEffectsReady);

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (isModelLoaded && isEffectsReady) {
      setAnimationsReady(true);
    }
  }, [isModelLoaded, isEffectsReady]);

  return (
    <div
      style={{
        opacity: animationsReady ? 1 : 0,
        visibility: animationsReady ? "visible" : "hidden",
        transition: "opacity 0.1s, visibility 0.1s",
        width: "100%",
        height: "100%",
      }}
    >
      <div style={{ position: "absolute", bottom: "20px", left: "20px", zIndex: 5}}>
        <button onClick={() => setIsActive(true)}>Activate</button>
        <button onClick={() => setIsActive(false)}>Stop</button>
      </div>
      <Stats />
      <Canvas
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: "low-power",
        }}
        dpr={[1, 2]}
        camera={{ near: 1, far: 1000, fov: 32 }}
        onPointerDown={handleInteraction}
        {...props}
      >
        <Suspense fallback={null}>
          <Preload all />
          <Turbine
            rotationSpeedRef={rotationSpeedRef}
            bladeLightIntensityRef={bladeLightIntensityRef}
            farmingAllowed={isActive}
            onLoaded={handleModelLoaded}
            startAnimation={animationsReady}
          />
          <WaterSurfaceSimple
            radius={100}
            segments={64}
            dimensions={512}
            waterColor={new THREE.Color("#555555")}
            fxMixColor={new THREE.Color("#000000")}
            position={[0, -8.32, -4]}
            distortionScale={4}
          />
          <RotatingBackground texturePath={backgroundWide} />
        </Suspense>
        {/* <OrbitControls /> */}
      </Canvas>
    </div>
  );
};

export default TurbineRenderer;
