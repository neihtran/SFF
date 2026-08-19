import { ThemeProvider } from 'next-themes';
import { AppRouter } from '@/router';
import { Toaster } from '@/components/ui/sonner';

export default function App(): React.ReactElement {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AppRouter />
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}
