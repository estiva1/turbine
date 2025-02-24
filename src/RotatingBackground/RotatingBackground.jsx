import gsap from "gsap";
import { RepeatWrapping } from "three";
import { useTexture } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { useFrame as useRaf } from "@darkroom.engineering/hamo";

const RotatingBackground = ({ texturePath, speed = 0.025, shiftOffset = 0, isMainBackground }) => {
  const texture = useTexture(texturePath);
  texture.wrapS = texture.wrapT = RepeatWrapping;

  const plateHeight = 100;
  const plateWidth = plateHeight * 2.67;

  const groupRef = useRef(null);
  const plateRefs = useRef([]);

  const [positionX, setPositionX] = useState(0);

  useRaf((_, delta) => {
    const clampedDelta = Math.min(delta, 0.1);
    const moveX = speed * clampedDelta * 16.67;

    for (let plate of plateRefs.current) {
      if (plate) plate.position.x -= moveX;
    }

    const rightmostX = Math.max(...plateRefs.current.map(plate => plate?.position.x ?? -Infinity));
    for (let plate of plateRefs.current) {
      if (plate && plate.position.x < -plateWidth) {
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
    <group ref={groupRef} position={[positionX, 0, 0]} visible={isMainBackground}>
      {[...Array(3)].map((_, i) => (
        <mesh key={i} ref={el => (plateRefs.current[i] = el)} position={[i * plateWidth - plateWidth, 0, -112]}>
          <planeGeometry args={[plateWidth, plateHeight]} />
          <meshBasicMaterial map={texture} />
        </mesh>
      ))}
    </group>
  );
};

export default RotatingBackground;
