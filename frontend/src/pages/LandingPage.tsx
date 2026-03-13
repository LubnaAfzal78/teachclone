import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import { GraduationCap, Video, Users, UserCog, Sparkles } from 'lucide-react';
import { UserType } from '../types';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleNavigation = (userType: UserType) => {
    navigate(`/login?type=${userType}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">
        <div className="text-white space-y-6 text-center md:text-left">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
            <GraduationCap className="w-6 h-6 text-yellow-300" />
            <span className="font-semibold tracking-wide">The Future of Education</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight">🎓 TeachNova</h1>

          <div className="inline-flex items-center gap-2 bg-yellow-300/15 text-yellow-100 border border-yellow-200/30 px-4 py-2 rounded-full text-sm font-semibold">
            <Sparkles className="w-4 h-4" />
            Powered by Amazon Nova
          </div>

          <p className="text-xl md:text-2xl text-purple-100 font-light">
            Learn from AI versions of your favorite teachers in English.
          </p>

          <p className="text-purple-200 text-lg max-w-lg mx-auto md:mx-0">
            Teachers upload videos, TeachNova analyzes their teaching style, and students get 24/7 multimodal tutoring.
          </p>
        </div>

        <Card className="w-full max-w-md mx-auto transform transition-all hover:scale-105">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Get Started</h2>
            <p className="text-gray-500 mt-2">Select your role to continue</p>
          </div>

          <div className="space-y-4">
            <Button variant="teacher" onClick={() => handleNavigation(UserType.TEACHER)}>
              <Video className="w-5 h-5" />
              Teacher Login
            </Button>

            <Button variant="student" onClick={() => handleNavigation(UserType.STUDENT)}>
              <Users className="w-5 h-5" />
              Student Login
            </Button>

            <div className="pt-4 border-t border-gray-100">
              <Button variant="admin" onClick={() => handleNavigation(UserType.ADMIN)}>
                <UserCog className="w-5 h-5" />
                Admin Login
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <footer className="absolute bottom-4 text-purple-200 text-sm">
        &copy; {new Date().getFullYear()} TeachNova. Powered by Amazon Nova.
      </footer>
    </div>
  );
};

export default LandingPage;
