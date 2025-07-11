import React from "react";

const TailwindTest: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold">🎉 Tailwind CSS is working!</h2>
      <p className="text-sm opacity-90">
        This gradient background and styling proves Tailwind is properly
        configured.
      </p>
    </div>
  );
};

export default TailwindTest;
