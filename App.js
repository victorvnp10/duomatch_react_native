import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, View, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db, doc, getDoc, setDoc } from "./firebase";

// Importa o Provider do Contexto de Onboarding
import { OnboardingProvider } from './components/context/OnboardingContext';

// Importa as telas principais do aplicativo
import AuthPage, { newUserData } from "./components/AuthPage";
import LinkingPage from "./components/LinkingPage";
import DuoMatchApp from "./components/DuoMatchApp";

// Componente de Loading reutilizável
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#EC4899" />
  </View>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Função para recarregar os dados do usuário, usada após a vinculação
  const fetchUserData = useCallback(async (currentUser) => {
    if (!currentUser) return;
    
    const userDocRef = doc(db, "users", currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const currentData = userDocSnap.data();
      // Se o usuário agora tem um parceiro, busca os dados dele também
      if (currentData.partnerId) {
        const partnerDocRef = doc(db, "users", currentData.partnerId);
        const partnerDocSnap = await getDoc(partnerDocRef);
        if (partnerDocSnap.exists()) {
          currentData.partnerData = partnerDocSnap.data();
        }
      }
      setUserData(currentData);
    }
  }, []);

  // Efeito principal para monitorar o estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          await fetchUserData(currentUser); // Usa a função para carregar dados
        } else if (newUserData) {
          // Lógica para criar um novo perfil de usuário
          const initialData = {
            nickname: newUserData.nickname,
            email: newUserData.email,
            partnerId: null,
            coupleId: null,
            score: 0,
          };
          await setDoc(userDocRef, initialData);
          setUserData(initialData);
        } else {
          // Caso inconsistente, força o logout
          console.error(`Usuário ${currentUser.uid} autenticado sem dados. Forçando logout.`);
          await signOut(auth);
          setUser(null);
          setUserData(null);
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserData]); // Adiciona fetchUserData às dependências

  // Renderização condicional das telas
  const renderContent = () => {
    if (loading) {
      return <LoadingScreen />;
    }
    if (!user) {
      return <AuthPage />;
    }
    if (!userData) {
      // Mostra o loading enquanto os dados do usuário ainda estão sendo buscados após o login
      return <LoadingScreen />;
    }
    if (!userData.partnerId || !userData.coupleId) {
      // Passa a função fetchUserData para a LinkingPage
      // para que ela possa sinalizar quando a vinculação estiver completa.
      return <LinkingPage user={user} userData={userData} onLinkingComplete={() => fetchUserData(user)} />;
    }
    return <DuoMatchApp user={user} userData={userData} />;
  };

  return (
    // O OnboardingProvider envolve todo o aplicativo
    <OnboardingProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        {renderContent()}
      </SafeAreaView>
    </OnboardingProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6', // bg-gray-100
    alignItems: 'center',
    justifyContent: 'center',
  },
});