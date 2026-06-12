import React from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'motion/react';

const pageVariants = {
  initial: { opacity: 0, y: 30, scale: 0.98 },
  in: { opacity: 1, y: 0, scale: 1 },
  out: { opacity: 0, y: -15 }
};

const pageTransition = {
  type: 'spring',
  stiffness: 260,
  damping: 25
};

const PageWrapper = ({ children }) => {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  );
};

export default PageWrapper;
