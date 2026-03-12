// components/FadeInUp.tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface FadeInUpProps {
  children: ReactNode;
  delay?: number; // 애니메이션 지연 시간 (기본값 0)
}

export default function FadeInUp({ children, delay = 0 }: FadeInUpProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} // 처음엔 투명하고 아래(30px)에 있음
      whileInView={{ opacity: 1, y: 0 }} // 화면에 보이면 원래 위치로 스르르 나타남
      viewport={{ once: true, margin: "-50px" }} // 화면에 들어오고 50px 지나서 한 번만 실행
      transition={{ duration: 0.6, delay: delay, ease: "easeOut" }} // 0.6초 동안 부드럽게
    >
      {children}
    </motion.div>
  );
}