import React, { useState } from 'react';
import { callNova } from '../services/novaService';
import Card from '../components/Card';
import Button from '../components/Button';
import { Bot, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TestNovaPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [response, setResponse] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleTestConnection = async () => {
    setStatus('loading');
    setResponse('');
    setErrorMessage('');

    const result = await callNova('Say hello and confirm that Amazon Nova on Bedrock is responding for TeachNova.');

    if (result.success && result.text) {
      setResponse(result.text);
      setStatus('success');
    } else {
      setErrorMessage(result.error || 'Failed to connect.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-gray-700 mb-6 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </button>

        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4 text-purple-600">
            <Bot className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Amazon Nova Connection Test</h1>
          <p className="text-gray-500 text-sm mt-1">Verify your Bedrock credentials and model access</p>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm font-mono text-gray-600">
            <strong>Prompt:</strong> "Say hello and confirm that Amazon Nova on Bedrock is responding for TeachNova."
          </div>

          {status === 'success' && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-lg animate-fade-in">
              <div className="flex items-center gap-2 mb-2 text-green-700 font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Response Received:</span>
              </div>
              <p className="text-gray-800">{response}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg animate-fade-in">
              <div className="flex items-center gap-2 mb-2 text-red-700 font-semibold">
                <AlertCircle className="w-5 h-5" />
                <span>Connection Failed:</span>
              </div>
              <p className="text-sm text-red-600">{errorMessage}</p>
            </div>
          )}

          <Button onClick={handleTestConnection} isLoading={status === 'loading'} variant="primary">
            {status === 'loading' ? 'Connecting to Nova...' : 'Run Nova Connection Test'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default TestNovaPage;
