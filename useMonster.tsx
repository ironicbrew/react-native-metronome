import React, {Dispatch, FC, SetStateAction, useEffect, useState} from 'react';
import { Image, ImageSourcePropType } from 'react-native';

interface Props {
  health: number;
  shield?: number;
  attack: number;
  handleMonsterAttack: (damage: number) => void;
  attackSpeed?: number;
  image: ImageSourcePropType;
}

const useMonster = ({
  health: initHealth,
  shield: initShield = 0,
  attack: initAttack,
  handleMonsterAttack,
  attackSpeed: initAttackSpeed = 3,
  image: initImage,
}: Props) => {
  const [health, setHealth] = useState(initHealth);
  const [shield] = useState(initShield);
  const [attack] = useState(initAttack);
  const [attackSpeed] = useState(initAttackSpeed);
  const [image] = useState(initImage);

//   useEffect(setAttackInterval);
  useEffect(handleHealthChange, [health]);

  function setAttackInterval() {
    const interval = setInterval(dealDamage, attackSpeed * 1000);
    return () => clearInterval(interval);
  }

  function handleHealthChange() {
    if (health < 0) {
      handleDeath();
    }
  }

  function handleDeath() {}

  function takeDamage(damage: number) {
    setHealth(health - damage);
  }

  function dealDamage(damage?: number) {
    handleMonsterAttack(damage || attack);
  }

  return {
    health,
    shield,
    attack,
    takeDamage,
    dealDamage,
    image,
  };
};

export default useMonster;
