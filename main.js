const net = require('net'); // Módulo node para server TCP
const { start } = require('repl');

// =================== VARIAVEIS GLOBAIS =======================
const ip = '127.0.0.1';
const porta = 55184;
let clientId = null;
let isTurn = false;
let gameId = null;
let game = null;

// ================== CLIENTE TCP ==============================
const clienteTcp = new net.Socket(); // Cria um socket para o cliente
clienteTcp.connect(porta, ip, () => { // Conecta no servidor
    console.log('Conected to server: ' + ip + ':' + porta);
})

// Lida com as respostas recebidas do servidor
clienteTcp.on('data', (data) => {
    const message = JSON.parse(data) // Converte todas as mensagens recebidas para JSON
    console.log('Received message: ' + message)

    // CONNECT
    if (message.type == 'connect') {
        handleConnection(message);
    }

    // CREATE
    if (message.type === 'create') {
        handleCreate(message);
    }

    // JOIN
    if (message.type === 'join') {
        handleJoin(message)
    }

    // UPDATE
    if (message.type === 'update') {
        handleUpdate(message)
    }

    // FINISH
    if (message.type === 'finish') {
        handleFinish(message)
    }

    // QUIT
    if (message.type === 'quit') {
        handleQuit(message)
    }

})

// ================= FUNÇÕES ===================================

/**
 * Armazena o id do cliente na variável global do cliente;
 * Exibe na tela que a conexão com o servidor foi estabelecida.
 * @param message
 */
function handleConnection(message) {
    clientId = message.clientId
    document.getElementById("connection").innerHTML = `<p class="text-success text-small"> Connected to server! ${ip + ":" + porta} </p>`
}

/**
 * Envia a mensagem para o servidor solicitando a criação do jogo
 */
function createGame() {
    const message = { type: 'create', clientId: clientId }
    clienteTcp.write(JSON.stringify(message))
}

/**
 * Armazena os dados recebidos da mensagem nas variáveis locais do cliente;
 * Preenche a div gameCreated com uma mensagem de sucesso;
 * Define o valor do inputGameId como a id do jogo
 * @param {*} message 
 * @returns 
 */
function handleCreate(message) {
    game = message.game
    gameId = game.id

    document.getElementById("gameCreated").innerHTML = `<p class="text-small"> Game created successfuly! Click bellow to join. </p>`
    document.getElementById("inputGameId").value = gameId

    return
}

/**
 * Envia para o servidor a mensagem para joinar um jogo;
 * Se o cliente possui a gameId na variável global, passa o gameId como parâmetro da mensagem;
 * Se o cliente não possui a gameId na variável global, passa o valor da inputGameId como parâmetro;
 * Armazena na variável global gameId o valor da inputGameId
 * @returns 
 */
function joinGame() {
    if (gameId === null) gameId = document.getElementById("inputGameId").value // Se o cliente não tiver a id do jogo, pega a id do input

    const message = { type: 'join', gameId: gameId, clientId: clientId }
    clienteTcp.write(JSON.stringify(message)) // Envia a mensagem

    return
}

/**
 * Envia a mensagem para o servidor iniciar o jogo
 */
function startGame() {
    const message = { type: 'start', game: game }
    clienteTcp.write(JSON.stringify(message))
}

/**
 * Atualiza as variáveis globais game e gameId e isTurn do cliente; 
 * Esconde a tela do menu; 
 * Mostra a tela do jogo;
 * Quando os dois players estiverem conectados, o Player 1 chama a 
 * função startGame() e envia a mensagem para o servidor iniciar o jogo;
 * @param {*} message 
 */
function handleJoin(message) {
    game = message.game
    gameId = message.gameId
    const clients = game.clients
    let menuScreen = document.getElementById("menuScreen")
    let gameScreen = document.getElementById("gameScreen")
    let playersDiv = document.getElementById("playersDiv")

    playersDiv.innerHTML = '' // Limpa a playersDiv
    menuScreen.style.display = 'none' // Esconde a tela do menu
    gameScreen.style.display = 'block' // Mostra a tela do jogo

    clients.forEach((client) => {
        if (client.clientId == clientId) isTurn = client.isTurn // Armazena o turno na variável global do cliente
        playersDiv.innerHTML += `<li class="list-unstyled-item"> ${client.username} connected. </li>` // Escreve na tela que o cliente se conectou
    })

    if (clients.length === 2) { // Inicia o jogo quando os dois players entrarem na sala
        playersDiv.innerHTML += `<li class="list-unstyled-item"> Game starting in 5 seconds... </li>`

        setTimeout(() => {
            playersDiv.innerHTML = '' // Limpa da tela o log de conexões na sala
            if (isTurn) startGame() // Apenas o Player 1 envia a mensagem para iniciar o jogo
        }, 5000)
    }
}

/**
 * Recebe o update do servidor e preenche os elementos da gameScreen com os dados
 * recebidos; Faz o controle dos turnos de cada cliente, armazenando na variável 
 * global os valores de isTurn; Adiciona event listener nos botões com as opções de 
 * resposta, quando clicados enviam uma mensagem para o servidor com a resposta
 * @param {*} message 
 */
function handleUpdate(message) {
    game = message.game
    let answerOptions = game.quote.answerOptions
    let clients = game.clients
    let turnInfo = document.getElementById("turnInfo")
    let quotesLeft = document.getElementById("quotesLeft")
    let player1Score = document.getElementById("player1Score")
    let player2Score = document.getElementById("player2Score")
    let quote = document.getElementById("quote")
    // Converte para uma array para fazer um forEach e preencher os botoões com as opções de resposta
    let resposeButtons = Array.from(document.getElementsByClassName("responseButtons"))
    document.getElementById("afterFinish").style.display = 'none'; // Esconde os botões

    clients.forEach((client) => { // Armazena o turno na variável global e exibe na tela de quem é o turno
        if (client.clientId == clientId) isTurn = client.isTurn // Armazena o turno na variável global do cliente
    })

    clients.forEach((client) => {
        if (client.isTurn) turnInfo.textContent = `${client.username}'s turn` // Exibe de quem é o turno
    })


    // Exibe os pontos dos jogadores
    player1Score.textContent = clients[0].points
    player2Score.textContent = clients[1].points
    quotesLeft.textContent = `Quote ${(20 - game.quotesLeft)}/20` // Exibe quantas frases faltam
    quote.textContent = game.quote.quote // Exibe a frase da rodada

    resposeButtons.forEach((button, i) => { // Popula os botões com as opções de resposta
        button.style.display = 'block'
        button.textContent = answerOptions[i]

        if (!isTurn) button.disabled = true; else button.disabled = false
    })
}

/**
 * Verifica a pontuação dos dois jogadores e retorna uma string com
 * o resultado da partida.
 * @param {*} player1 
 * @param {*} player2 
 * @returns {*} String gameResult
 */
function checkWinner(player1, player2) {
    let gameResult = ''
    if (player1.points > player2.points) {
        gameResult = `${player1.username} Won! ${player1.points} x ${player2.points}`
        return gameResult
    }
    else if (player1.points == player2.points) {
        gameResult = `It's a draw! ${player1.points} x ${player2.points}`
        return gameResult
    }
    else {
        gameResult = `${player2.username} Won! ${player1.points} x ${player2.points}`;
        return gameResult
    }
}

/**
 * Verifica quem foi o vencedor e exibe na tela, exibe botões para jogar
 * novamente ou para voltar ao menu inicial
 * @param {*} message 
 */
function handleFinish(message) {
    game = message.game
    let clients = game.clients
    let player1 = clients[0]
    let player2 = clients[1]

    let divAfterFinish = document.getElementById("afterFinish")
    let turnInfo = document.getElementById("turnInfo")
    let quotesLeft = document.getElementById("quotesLeft")
    let player1Score = document.getElementById("player1Score")
    let player2Score = document.getElementById("player2Score")
    let quote = document.getElementById("quote")
    // Converte para uma array para fazer um forEach e preencher os botoões com as opções de resposta
    let resposeButtons = Array.from(document.getElementsByClassName("responseButtons"))


    turnInfo.textContent = 'Game Finished!'
    quotesLeft.textContent = ''
    player1Score.textContent = player1.points
    player2Score.textContent = player2.points
    quote.textContent = checkWinner(player1, player2)

    resposeButtons.forEach((button, i) => { // Esconde os botões de resposta
        button.textContent = ''
        button.style.display = 'none'
    })

    divAfterFinish.style.display = 'block' // Mostra os botoes jogar novamente e quit

    clients.forEach((client) => {
        if (player2.clientId == clientId) document.getElementById("btnPlayAgain").disabled = true
    })
}

/**
 * Ao receber a mensagem quit do servidor, verifica se o clientId do usuário
 * é igual ao do cliente que desconectou, caso sim, volta a tela do menu inicial
 * @param {*} message 
 */
function handleQuit(message) {
    if (message.clientId == clientId) {
        document.getElementById("gameCreated").innerHTML = ''
        document.getElementById("inputGameId").value = ''
        document.getElementById("menuScreen").style.display = 'block'
        document.getElementById("gameScreen").style.display = 'none'
    }
}



// Envia a resposta para o servidor ao clicar em algum dos botões com opção de resposta
document.addEventListener('click', function (event) {
    if (event.target.classList.contains('responseButtons') && isTurn) { // Se clicou no botao de resposta e foro turno do jogador
        let selectedAnswer = event.target.textContent.trim();
        const answer = game.quote.answer.trim();

        if (selectedAnswer == answer) { // Se a resposta estiver correta
            let clientIndex = game.clients.findIndex(client => client.clientId === clientId); // Encontra o index do cliente na array
            game.clients[clientIndex].points += 100 // Atualiza os pontos do cliente na posição clientIndex

            let answerElement = document.getElementById("answer")
            answerElement.classList.add('text-success')
            answerElement.textContent = `+100 points! The correct answer is ${answer}` // Exibe na tela que a resposta está correta

            setTimeout(() => { // Aguarda 3 segundos e envia a resposta para o servidor
                answerElement.textContent = ''
                answerElement.classList.remove('text-success')

                const message = { type: 'answer', answer: selectedAnswer, game: game, clientId: clientId }
                clienteTcp.write(JSON.stringify(message))
            }, 2500)
        }
        else if (selectedAnswer !== answer) { // Se a resposta estiver 
            let answerElement = document.getElementById("answer")
            answerElement.classList.add('text-danger')
            answerElement.textContent = `Wrong! The correct answer is ${answer}` // Exibe na tela que a resposta está correta

            setTimeout(() => { // Aguarda 3 segundos e envia a resposta para o servidor
                answerElement.classList.remove('text-danger')
                answerElement.textContent = ''
                const message = { type: 'answer', game: game, clientId: clientId }
                clienteTcp.write(JSON.stringify(message))
            }, 2500)
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {

    // Botão para jogar novamente, volta o jogo para o estado inicial e envia a mensagem start para o servidor
    document.getElementById("btnPlayAgain").addEventListener('click', () => {
        game.quotesLeft = 20
        game.quote = { quote: '', answer: '', answerOptions: [] }
        game.clients[0].isTurn = true
        game.clients[1].isTurn = false
        game.clients.forEach((client) => {
            client.points = 0
        })

        startGame(); // Inicia um novo jogo

        document.getElementById("afterFinish").style.display = 'none'; // Esconde os botões
    });

    // Botão para quitar do jogo, envia a mensagem quit para o servidor. Remove o cliente do objeto do jogo
    document.getElementById("btnQuit").addEventListener('click', () => {
        const message = { type: 'quit', clientId: clientId, gameId: gameId, game: game };
        clienteTcp.write(JSON.stringify(message));

        document.getElementById("afterFinish").style.display = 'none'; // Esconde os botões
    });
});



