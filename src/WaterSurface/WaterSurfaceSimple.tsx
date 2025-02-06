import React, { useMemo, useRef, ReactNode } from "react";
import { CircleGeometry, RepeatWrapping, Vector2 } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

import { WaterSimple } from "./Water/WaterSimple";
import waterNormalsSimple from "../assets/noise.jpg";

import { WaterContext } from "./WaterContext";

interface WaterSurfaceSimpleProps {
  radius?: number;
  segments?: number;
  dimensions?: number;
  waterColor?: number;
  position?: [number, number, number];
  distortionScale?: number;
  fxDistortionFactor?: number;
  fxDisplayColorAlpha?: number;
  fxMixColor?: number;
  children?: ReactNode;
}

export default function WaterSurfaceSimple({
  radius = 60,
  segments = 64,
  dimensions = 256,
  waterColor = 0x000000,
  position = [0, 0, 0],
  distortionScale = 4,
  fxDistortionFactor = 0.3,
  fxDisplayColorAlpha = 0.0,
  fxMixColor = 0x000000,
  children,
}: WaterSurfaceSimpleProps) {
  const ref = useRef<THREE.Mesh>(null);
  const refPointer = useRef<Vector2>(new Vector2(0, 0));

  const gl = useThree(state => state.gl);
  const waterNormals = useTexture(waterNormalsSimple);
  waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

  // Use CircleGeometry instead of PlaneGeometry
  const geom = useMemo(() => new CircleGeometry(radius, segments), [radius, segments]);

  const config = useMemo(
    () => ({
      radius: radius,
      segments: segments,
      dimensions: dimensions,
      textureWidth: dimensions,
      textureHeight: dimensions,
      waterNormals,
      waterColor: waterColor,
      distortionScale: distortionScale,
      fxDistortionFactor: fxDistortionFactor,
      fxDisplayColorAlpha: fxDisplayColorAlpha,
      fxMixColor: fxMixColor,
      format: (gl as any).encoding,
    }),
    [dimensions, distortionScale, fxDisplayColorAlpha, fxDistortionFactor, fxMixColor, gl, waterColor, waterNormals, radius, segments]
  );

  //@ts-ignore
  useFrame((state, delta) => {
    if (ref.current) {
      //@ts-ignore
      ref.current.material.uniforms.time.value += delta / 2;
    }
  });

  const waterObj = useMemo(() => new WaterSimple(geom, config), [geom, config]);

  return (
    //@ts-ignore
    <WaterContext.Provider value={{ ref: ref, refPointer: refPointer }}>
      <primitive ref={ref} object={waterObj} rotation-x={-Math.PI / 1.875} position={position} scale={[0.27, 1, 1]} />
      {children}
    </WaterContext.Provider>
  );
}
