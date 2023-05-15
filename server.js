const net = require('net'); // Módulo node para server TCP
const axios = require('axios'); // Módulo para requisições na API
const { v4: uuidv4 } = require('uuid'); // Módulo para gerar id's aleatórios

// ========================== VARIÁVEIS GLOBAIS ===============================
const ip = '127.0.0.1';
const porta = 55184;
let clients = [] // Array para armazenar as conexões no servidor
let games = {} // Informaçoes dos jogos

// ========================== SERVIDOR =========================================
const server = net.createServer( // Cria o servidor
    (socket) => {   // Lida com os sockets conectados

        handleConnection(socket) // Ao cliente conectar no servidor;

        socket.on('data', (data) => { // Ao receber mensagens do cliente
            const message = JSON.parse(data);
            console.log('Message received: ', message);

            if (message.type === 'create') {
                createGame(socket)
            }

            if (message.type === 'join') {
                handleJoin(message)
            }

            if (message.type === 'start') {
                handleStart(message)
            }

            if (message.type === 'answer') {
                handleAnswer(message)
            }

            if (message.type === 'quit') {
                handleQuit(message)
            }


        })

        socket.on('close', () => {
            console.log("Client disconnected.")
            socket.destroy()
        })

        socket.on('error', (error) => {
            console.log(error)
            socket.destroy();
        })
    })

server.listen(porta, ip, () => { // Servidor ouve e aguarda por conexões
    console.log('Server listening on: ' + ip + ':' + porta);
})


// ========================== FUNÇÕES ==========================================
/**
 * Gera um id aleatório
 * @returns id Aleatório
 */
function guid() {
    return uuidv4();
}

/**
 * Quando um cliente conecta, gera um id aleatório e armazena as informações
 * do socket na array clients.
 * Envia uma resposta de connect para o socket com a id do cliente.
 * @param {*} socket 
 */
function handleConnection(socket) {
    const clientId = guid() // Gera id aleatório para o cliente
    clients[clientId] = socket // Armazena o socket no array de clientes

    console.log('New connection. ID: ' + clientId)

    // Envia uma mensagem de connect para o cliente
    const response = { type: 'connect', clientId: clientId }
    socket.write(JSON.stringify(response))
    console.log('Response sent: ' + JSON.stringify(response))

    return
}

/**
 * Gera um id aleatório para o jogo;
 * Armazena o objeto do jogo na variável global games
 * Envia para o cliente a resposta de create, contendo o objeto do jogo
 * @param socket
 */
function createGame(socket) {
    const gameId = guid()
    games[gameId] = { id: gameId, quotesLeft: 2, quote: {}, clients: [] } // Cria um jogo e armazena na array de games | Inicia com valores padrão

    const response = { type: 'create', game: games[gameId] }
    socket.write(JSON.stringify(response))

    console.log('Response sent: ' + JSON.stringify(response))
}

/**
 * Recebe a mensagem de join do cliente;
 * Proibe mais de 2 clientes no jogo; 
 * Define um username para o player; 
 * Define o isTurn do player (Se for o primeiro a se conectar será o Player 1); 
 * Define o objeto do cliente;
 * Armazena o cliente na array game.clients[];
 * Envia a resposta para todos os players do jogo
 * @param {*} message 
 * @returns 
 */
function handleJoin(message) {
    const clientId = message.clientId
    const gameId = message.gameId
    const game = games[gameId]

    if (game.clients.length >= 2) return // Proibe mais de 2 clientes no jogo

    const usernames = ['Player 1', 'Player 2'] // Define os usernames, o primeiro a se conectar é o Player 1
    const username = usernames[game.clients.length]

    let isTurn = null
    if (username === 'Player 1') isTurn = true; else isTurn = false // O primeiro a se conectar começa jogando

    const client = { clientId: clientId, username: username, points: 0, isTurn: isTurn }

    game.clients.push(client)

    const response = { type: 'join', game: game }
    game.clients.forEach((client) => { // Envia a resposta para cada cliente conectado no jogo
        clients[client.clientId].write(JSON.stringify(response))
    });
    console.log('Response sent: ' + JSON.stringify(response))

    games[gameId] = game // Atualiza o game na array de games
}

/**
 * Faz uma requisição de uma frase para a API, retorna um objeto contendo 
 *  a frase, a resposta correta e um array com 4 opções de resposta randomizadas,
 * sendo uma delas a alternativa correta.
 * @returns quote
 */
async function fetchQuote() {
    try {
        // Array com todas as opções de resposta
        let allAuthors = ['Walter White', 'Saul Goodman', 'Jesse Pinkman', 'Walter White Jr', 'Skyler White',
            'Gustavo Fring', 'Hank Schrader', 'Mike Ehrmantraut', 'The fly', 'Badger']

        const response = await axios.get('https://api.breakingbadquotes.xyz/v1/quotes') // Faz a requisição para a API
        const data = await response.data[0]

        let frase = data.quote
        let answer = data.author

        const answerIndex = allAuthors.indexOf(answer) // Encontra em qual índice do array está a resposta correta
        allAuthors.splice(answerIndex, 1) // Remove a resposta correta da lista de autores

        for (let i = allAuthors.length - 1; i > 0; i--) { // Randomiza a ordem dos dados da array
            const j = Math.floor(Math.random() * (i + 1));
            [allAuthors[i], allAuthors[j]] = [allAuthors[j], allAuthors[i]];
        }

        const answerOptions = allAuthors.slice(0, 4); // Seleciona 4 opções de resposta do array
        answerOptions[Math.floor(Math.random() * 4)] = answer; // Substitui uma das opções pela resposta correta

        const quote = { quote: frase, answer: answer, answerOptions: answerOptions }
        console.log('\n Quote fetched: ' + frase + '\t Answer: ' + answer)

        return quote
    } catch (error) {
        console.log(error)
        return null
    }
}

/**
 * Ao receber a mensagem de start do cliente, executa a função
 * fetchQuote(), decrementa as quotesLeft e envia o update com o 
 * game state atualizado para o cliente, iniciando o jogo.
 * @param {*} message 
 */
async function handleStart(message) {
    let game = message.game

    game.quote = await fetchQuote()
    console.log(game.quote)
    game.quotesLeft--

    const response = { type: 'update', game: game }
    game.clients.forEach((client) => { // Envia o update para todos os players do jogo
        clients[client.clientId].write(JSON.stringify(response))
        console.log('Response sent: ' + JSON.stringify(response))
    })


    games[game.id] = game // Atualiza o jogo na array de games
}

/**
 * A cada mensagem do tipo answer recebida dos clientes,
 * altera os turnos dos jogadores e verifica se já foram jogados todos
 * os turnos, caso sim envia a resposta finish para os clientes, caso não
 * executa a função fetchQuote(), decrementa as quotesLeft e envia o update
 * do game state para os jogadores
 * @param {*} message 
 */
async function handleAnswer(message) {
    let game = message.game
    let players = game.clients

    players.forEach((player) => { // Altera o turno dos players
        player.isTurn = !player.isTurn
    })

    if (game.quotesLeft == 0) { // Se já foram todos os turnos, envia a mensagem de finish
        const response = { type: 'finish', game: game }

        game.clients.forEach((client) => {
            clients[client.clientId].write(JSON.stringify(response))
        })
    } else {
        game.quote = await fetchQuote()
        game.quotesLeft--

        const response = { type: 'update', game: game }
        game.clients.forEach((client) => { // Envia a resposta para todos os players do jogo
            clients[client.clientId].write(JSON.stringify(response))
            console.log(JSON.stringify(response))
        })
    }

    games[game.id] = game // Atualiza o game na array games
}

/**
 * Remove o cliente que enviou a mensagem da array de clientes do jogo,
 * caso só haja um cliente no jogo, deleta o objeto inteiro do jogo
 * @param {*} message 
 */
function handleQuit(message) {
    let gameId = message.gameId;
    let game = message.game
    let gameClients = game.clients;
    let clientId = message.clientId;

    const response = { type: 'quit', clientId: clientId }

    if (gameClients.length == 1) { // Se só houver 1 cliente, deleta o jogo inteiro da array

        gameClients.forEach((client) => {
            clients[client.clientId].write(JSON.stringify(response))
        })

        delete games[gameId]
        console.log(games[gameId])
    } else if (gameClients.length > 1) { // Se houver mais de 1, remove o cliente do jogo

        gameClients.forEach((client) => {
            clients[client.clientId].write(JSON.stringify(response))
        })

        // Encontra o índice do cliente na array de clientes do jogo
        let clientIndex = gameClients.findIndex((client) => client.clientId === clientId);
        gameClients.splice(clientIndex, 1);
        console.log(gameClients)
    }


}

