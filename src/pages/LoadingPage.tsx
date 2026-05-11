import React, { useEffect} from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../utils/useUser';
//import './css/LoadingPage.css'; // Create this for styling




const LoadingPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  
  useEffect(() => {
  

        if (!user) {
          navigate('/login');
        } else {
          const lastPage = user.CurrentNav || '/landing';
          navigate(lastPage);
        }
      


  
  }, [ user, navigate]);

  return (
    null
  );
};

export default LoadingPage;