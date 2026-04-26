// app/workspace/page.tsx
import AnalysisApp from '../../components/analysis-app';

export default function WorkspacePage() {
  return (
    <div className="pt-8">
      {/* Aqui importamos o seu componente que já tem toda a lógica pronta */}
      <AnalysisApp /> 
    </div>
  );
}