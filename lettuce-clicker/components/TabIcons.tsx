import React from 'react';
import { Image } from 'react-native';

interface IconProps {
  color: string; // kept for API consistency; PNGs won’t tint unless designed as template
  size?: number;
}

export const HomeIcon: React.FC<IconProps> = ({ size = 22 }) => (
  <Image
    source={require('../assets/images/home-removebg-preview.png')}
    style={{ width: size, height: size, resizeMode: 'contain' }}
  />
);

export const PineTreeIcon: React.FC<IconProps> = ({ size = 26 }) => (
  <Image
    source={require('../assets/images/pine-tree-removebg-preview.png')}
    style={{ width: size, height: size, resizeMode: 'contain' }}
  />
);

export const EnergyIcon: React.FC<IconProps> = ({ size = 26 }) => (
  <Image
    source={require('../assets/images/energy-removebg-preview.png')}
    style={{ width: size, height: size, resizeMode: 'contain' }}
  />
);
