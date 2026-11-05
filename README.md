====================================================================

                     PROJETO REDES - BACKEND

====================================================================



API responsável pelo processamento, gerenciamento de dados e regras

de negócio da aplicação desenvolvida para a disciplina de Redes de

Computadores.



--------------------------------------------------------------------

1. TECNOLOGIAS UTILIZADAS

--------------------------------------------------------------------

- Node.js: Ambiente de execução JavaScript no servidor

- Express: Framework web para construção de rotas e middlewares

- SQLite: Banco de dados relacional leve para persistência local (database.sqlite)

- Git: Controle de versão do código



--------------------------------------------------------------------

2. ESTRUTURA DO PROJETO

--------------------------------------------------------------------

Projeto-Redes/backend/

├── database.sqlite      # Banco de dados SQLite local (ignorado pelo Git)

├── node_modules/        # Dependências do projeto

├── package.json         # Configurações, scripts e dependências

├── .gitignore           # Regras de exclusão de arquivos para o Git

└── README.txt           # Documentação do projeto



--------------------------------------------------------------------

3. PRÉ-REQUISITOS

--------------------------------------------------------------------

Certifique-se de ter as seguintes ferramentas instaladas na sua máquina:

- Node.js (versão 18 ou superior recomendada): https://nodejs.org/

- Gerenciador de pacotes npm (geralmente instalado junto com o Node.js)



--------------------------------------------------------------------

4. INSTALAÇÃO E CONFIGURAÇÃO

--------------------------------------------------------------------

1. Clone o repositório e navegue até a pasta do backend:

   cd Projeto-Redes/backend



2. Instale as dependências do projeto:

   npm install



--------------------------------------------------------------------

5. COMO EXECUTAR A APLICAÇÃO

--------------------------------------------------------------------

- Modo de Desenvolvimento:

  Para rodar a aplicação com reinicialização automática do frontend:

  npm run dev



- Modo de Produção:

  Para iniciar o servidor backend:

  npm start



* O servidor estará disponível em http://localhost:3001.



--------------------------------------------------------------------

6. COMO EXECUÇÃO DOS TESTES

--------------------------------------------------------------------

Para garantir que o backend está funcionando corretamente e validar

as rotas/regras implementadas, execute o comando de testes:



   npm test

Além disso na interface frontend é possível executar os testes de RTT e Throughput,
além do envio das mensagens e visualização do histórico.

Somado a isso foi adicionado no arquivo ExpD-transporte.js um experimento em JavaScript
referente à comparação de protocolos da camada de transporte TCP e UDP,
para executá-lo basta rodar o comando:

node ExpD-transporte.js

na raiz do projeto.


====================================================================
