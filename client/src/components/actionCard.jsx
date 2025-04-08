import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function ActionCard({ action, delay }) {
  const navigate = useNavigate();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100"
      onClick={() => navigate('/log-action', { state: { presetAction: action } })}
    >
      <div className="text-green-500 mb-2">{action.icon}</div>
      <span className="text-sm font-medium text-gray-700">{action.name}</span>
      <span className="text-xs text-green-600 mt-1">+{action.points} pts</span>
    </motion.button>
  );
}