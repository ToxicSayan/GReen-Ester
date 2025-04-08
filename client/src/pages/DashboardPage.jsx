import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Leaf, Bike, Recycle, Bus, Tree, Sun, Zap, Award } from 'lucide-react';
import ActionCard from '../components/dashboard/ActionCard';
import StatsCard from '../components/dashboard/StatsCard';

const actionTypes = [
  { name: 'Public Transport', icon: <Bus size={24} />, points: 15, co2: 2.5 },
  { name: 'Cycling', icon: <Bike size={24} />, points: 20, co2: 3.0 },
  { name: 'Recycling', icon: <Recycle size={24} />, points: 10, co2: 1.5 },
  { name: 'Planting', icon: <Tree size={24} />, points: 25, co2: 5.0 },
  { name: 'Solar Energy', icon: <Sun size={24} />, points: 30, co2: 8.0 },
  { name: 'Energy Saving', icon: <Zap size={24} />, points: 15, co2: 2.0 }
];

export default function DashboardPage() {
  const { currentUser, userData } = useAuth();
  const [stats, setStats] = useState({
    weeklyData: [],
    recentActions: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      // Get recent actions
      const actionsRef = collection(db, 'actions');
      const actionsQuery = query(
        actionsRef, 
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      
      const actionsSnapshot = await getDocs(actionsQuery);
      const recentActions = actionsSnapshot.docs.map(doc => doc.data());
      
      // Generate weekly data
      const weeklyData = generateWeeklyData(recentActions);
      
      setStats({
        weeklyData,
        recentActions
      });
      setLoading(false);
    };
    
    fetchData();
  }, [currentUser, userData]);

  const generateWeeklyData = (actions) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    
    return days.map((day, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() - now.getDay() + i);
      
      const dayActions = actions.filter(action => {
        const actionDate = action.timestamp.toDate();
        return actionDate.getDay() === date.getDay() && 
               actionDate.getDate() === date.getDate();
      });
      
      const points = dayActions.reduce((sum, action) => sum + action.points, 0);
      const co2 = dayActions.reduce((sum, action) => sum + action.co2Saved, 0);
      
      return {
        name: day,
        points,
        co2: parseFloat(co2.toFixed(2))
      };
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto"
      >
        {/* Welcome Section */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-green-800">
            Welcome back, {userData?.name || 'Eco Warrior'}!
          </h1>
          <p className="text-green-600 mt-2">
            You've saved {userData?.totalCO2Saved || 0} kg of CO₂ so far
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard 
            title="Total Points"
            value={userData?.totalPoints || 0}
            icon={<Award className="text-green-500" />}
            color="bg-green-100"
          />
          <StatsCard 
            title="CO₂ Saved (kg)"
            value={userData?.totalCO2Saved?.toFixed(2) || 0}
            icon={<Leaf className="text-green-500" />}
            color="bg-blue-100"
          />
          <StatsCard 
            title="Current Streak"
            value={userData?.streak || 0}
            icon={<Zap className="text-green-500" />}
            color="bg-yellow-100"
          />
        </div>

        {/* Weekly Activity Chart */}
        <motion.div 
          className="bg-white p-6 rounded-xl shadow-md mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-xl font-semibold text-green-800 mb-4">Weekly Activity</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    border: 'none'
                  }}
                />
                <Bar 
                  dataKey="co2" 
                  name="CO₂ Saved (kg)"
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]}
                  animationBegin={100}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-xl font-semibold text-green-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {actionTypes.map((action, index) => (
              <ActionCard 
                key={action.name}
                action={action}
                delay={index * 0.1}
              />
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          className="bg-white p-6 rounded-xl shadow-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h2 className="text-xl font-semibold text-green-800 mb-4">Recent Activity</h2>
          {stats.recentActions.length > 0 ? (
            <ul className="space-y-3">
              {stats.recentActions.map((action, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                  className="flex items-center justify-between p-3 hover:bg-green-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-green-100 rounded-full mr-3">
                      {actionTypes.find(a => a.name === action.type)?.icon || <Leaf size={18} />}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-800">{action.type}</h4>
                      <p className="text-sm text-gray-500">
                        {action.timestamp.toDate().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">+{action.points} pts</p>
                    <p className="text-xs text-gray-500">{action.co2Saved} kg CO₂</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          ) : (
            <motion.p 
              className="text-gray-500 text-center py-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              No recent activities. Log your first eco action today!
            </motion.p>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}