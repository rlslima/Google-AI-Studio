
import React from 'react';

const Header: React.FC = () => {
    return (
        <header className="text-center">
            <h1 className="text-3xl font-bold text-slate-100">Gerador de Áudio em Lote</h1>
            <p className="mt-2 text-slate-400">Envie múltiplos arquivos de texto e gere áudio para cada um em uma fila.</p>
        </header>
    );
};

export default Header;
