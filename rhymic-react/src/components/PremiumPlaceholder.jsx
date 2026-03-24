import React from 'react';
import { Sparkles, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './PremiumPlaceholder.module.css';

const PremiumPlaceholder = ({ title, description }) => {
  const navigate = useNavigate();

  return (
    <div className={styles.placeholderContainer}>
      <div className={styles.glowEffect}></div>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <Crown size={48} className={styles.crownIcon} />
          <Sparkles size={24} className={styles.sparkleOne} />
          <Sparkles size={20} className={styles.sparkleTwo} />
        </div>
        
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>
          {description || "This feature is currently under development. Upgrade to Premium to get early access when it launches."}
        </p>
        
        <div className={styles.actionButtons}>
          <button className={styles.upgradeBtn}>
            Upgrade to Premium
          </button>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default PremiumPlaceholder;
