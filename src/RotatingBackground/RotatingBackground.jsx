import gsap from "gsap";
import { RepeatWrapping } from "three";
import { useTexture } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { useFrame as useRaf } from "@darkroom.engineering/hamo";

const RotatingBackground = ({ texturePath, speed = 0.025, shiftOffset = 0 }) => {
  const texture = useTexture(texturePath);
  texture.wrapS = texture.wrapT = RepeatWrapping;

  const initPositionX = 0;
  const plateHeight = 100;
  const plateWidth = plateHeight * 2.67;

  const groupRef = useRef(null);
  const plate1Ref = useRef(null);
  const plate2Ref = useRef(null);
  const plate3Ref = useRef(null);
  const plateRefs = useRef([]);

  useEffect(() => {
    plateRefs.current = [plate1Ref.current, plate2Ref.current, plate3Ref.current];
  }, []);

  const [positionX, setPositionX] = useState(initPositionX);

  useRaf((_, delta) => {
    const normalizedDelta = delta / (1000 / 60);
    const moveX = speed * normalizedDelta;

    for (let plate of plateRefs.current) {
      plate.position.x -= moveX;
    }

    const rightmostX = Math.max(...plateRefs.current.map(plate => plate.position.x));
    for (let plate of plateRefs.current) {
      if (plate.position.x < -plateWidth) {
        plate.position.x = rightmostX + plateWidth;
      }
    }
  });

  useEffect(() => {
    if (groupRef.current && groupRef.current.position.x !== shiftOffset) {
      shiftPosition(shiftOffset);
    }
  }, [shiftOffset]);

  const shiftPosition = targetPosition => {
    gsap.to(groupRef.current.position, {
      x: targetPosition,
      duration: 1,
      ease: "power1.inOut",
      onComplete: () => {
        setPositionX(targetPosition);
      },
    });
  };

  return (
    <group ref={groupRef} position={[positionX, 0, 0]}>
      <mesh ref={plate1Ref} position={[-plateWidth, 0, -112]}>
        <planeGeometry args={[plateWidth, plateHeight]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <mesh ref={plate2Ref} position={[0, 0, -112]}>
        <planeGeometry args={[plateWidth, plateHeight]} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <mesh ref={plate3Ref} position={[plateWidth, 0, -112]}>
        <planeGeometry args={[plateWidth, plateHeight]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </group>
  );
};

export default RotatingBackground;
