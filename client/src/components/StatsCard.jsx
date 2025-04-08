import { motion } from 'framer-motion';

export default function StatsCard({ title, value, icon, color }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`p-6 rounded-xl shadow-md border-l-4 border-green-500 ${color}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
          <motion.p 
            className="text-3xl font-bold text-green-600"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {value}
          </motion.p>
        </div>
        <div className="p-2 bg-white rounded-full shadow-sm">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}