//------------------------------------
// JestWebsocketServer Class
//------------------------------------
// Server class for managing WebSocket connections, players, and events.
const WebSocket = require('ws');
class JestWebsocketServer {
	//----------------------------------
	// Core Server Fields
	//----------------------------------
	wss					= null;			// [WebSocket.Server] active socket server instance
	players				= {};			// [object] mapping: client id => player object
	HEARTBEAT_INTERVAL	= 30000;		// [int] ms interval to ping/purge dead sockets
	skeys				= null;			// [Set<string>] generated unique keys for active clients

	//----------------------------------
	// Constructor
	//----------------------------------
	// Construct the WebSocket server.
	// *port		- [int] port number to listen on.
	constructor( port=8080 ) {
		// Create websocket [object]
		this.wss	= new WebSocket.Server({ port });
		// Setup websocket handlers
		console.log( `[JESTWebsocketServer] Server running on ws://localhost:${port}` );
		this.logClientCount();	// log current connected client count
		this.setupHeartbeat();	// create loop for cleaning up dead connections
		this.setupHandlers();	// create callback event(s)
		// Setup properties
		this.skeys	= new Set();
	}

	//------------------------------------
	// Setup Methods
	//------------------------------------
	// Setup connection handling.
	setupHandlers() {
		this.wss.on( 'connection', ws=>this.handleConnection(ws) );
	}

	//------------------------------------
	// Heartbeat Purge System
	//------------------------------------
	// Pings every client at interval. If unresponsive,
	// terminates their socket.
	setupHeartbeat() {
		setInterval(
			() => {
				this.logClientCount();
				this.wss.clients.forEach(
					ws => {
						if ( !ws.isAlive )
							return ws.terminate(); // kill zombie
						ws.isAlive = false;	// flag for ping test
						ws.ping();			// send ping
					});
			}, this.HEARTBEAT_INTERVAL );
	}

	//------------------------------------
	// Handle Incoming Connection
	//------------------------------------
	// Generates new player ID, sets up player state,
	// assigns socket listeners, and broadcasts join.
	handleConnection( ws ) {
		const id		= this.generateKey();	// generate unique ID
		ws.id			= id;					// bind to socket
		ws.username		= "guest";				// assign temp username
		ws.isAlive		= true;					// alive flag for heartbeat
		ws.on( 'pong', () => ws.isAlive=true );	// revive on pong

		// Initialize player data
		this.players[id] =
			{
				id       : id,
				//ws       : ws,
				username : ws.username,
				x        : 0,
				y        : 0,
				head     : "head1.gif",
				body     : "body.png",
				sword    : "sword1.png",
				mode     : "idle",
				dir      : 0
			};

		// Initialize messages
		console.log( `[JESTWebsocketServer] Client ${id} connected` );

		// Notify new user its id + all existing players connected
		// Send init packet (self ID + all clients)
		ws.send( JSON.stringify({
			type     : "init",
			id       : id,
			username : ws.username,
			clients  : this.players
			}));

		// Notify everyone *except* new player
		this.broadcastExcept( id, {
			type     : "guestJoin",
			id       : id,
			username : ws.username,
			player   : this.players[id]
			});

		// Bind message listener, scoped to ID
		ws.on( 'message', message => this.handleMessage(id, message) );

		// Bind disconnect listener
		ws.on( 'close', () => this.handleDisconnect(id) );
	}

	//------------------------------------
	// Handle Incoming Message
	//------------------------------------
	// Processes messages by player ID.
	// Updates internal player state, then broadcasts to all.
	// NOTE: "id" is assigned internally to websocket & passed via bound listener.
	handleMessage( id, message ) {
		try {
			// Parse data received from user.
			const data = JSON.parse( message );
			// Determine type of message taking place.
			if ( data.type==="userUpdate" ) {
				//console.error( "[JESTWebsocketServer] userUpdate:", data );
				//----------------------------------
				// Begin return response.
				//----------------------------------
				const response	=
					{
					id:		id,
					type:	"guestUpdate",
					action:	data.action
					};
				const client	= this.players[id]; // user being changed
				//----------------------------------
				// Determine action being taken
				//----------------------------------
				switch ( data.action ) {
					case "move": // user moved location
						// Update player movements.
						client.x		= data.x;
						client.y		= data.y;
						// Build return response for guest update.
						response.x		= data.x;
						response.y		= data.y;
						break;
					case "mode": // user animation changed
						// Update player movements.
						client.mode		= data.mode;
						// Build return response for guest update.
						response.mode	= data.mode;
						break;
					case "dir": // user direction changed
						// Update player movements.
						client.dir		= data.dir;
						// Build return response for guest update.
						response.dir	= data.dir;
						break;
				}
				//----------------------------------
				// Broadcast update to all users.
				//----------------------------------
				this.broadcastExcept( id, response ); // update all users
			}
		}
		catch ( err ) { // error
			console.error( "[JESTWebsocketServer] Invalid message:", err );
		}
	}

	//----------------------------------
	// Handle Disconnection
	//----------------------------------
	// Removes client entry and notifies all players.
	handleDisconnect( id ) {
		console.log( `[JESTWebsocketServer] Client ${id} disconnected` );
		delete this.players[id];
		this.broadcast( { type: "guestLeave", id } );
	}

	// -------------------------
	// Get Player Object by WebSocket
	// -------------------------
	// Looks through all players and returns the one whose ws matches.
	// RETURNS: [object|null] the player object, or null if not found.
	getPlayerByWs( ws ) {
		// Iterate all players & find matching client.
		for ( const player of Object.values(this.players) )
			if ( player.ws===ws ) return player;
		return null; // not found
	}

	//----------------------------------
	// Broadcast All Clients
	//----------------------------------
	// Sends message to *all* open sockets.
	broadcast( data ) {
		const msg = JSON.stringify( data );
		this.wss.clients.forEach(
			client => {
				if ( client.readyState===WebSocket.OPEN ) {
					client.send( msg );
				}
			});
	}

	//----------------------------------
	// Broadcast All Except One
	//----------------------------------
	// Sends JSON message to all but the excluded socket.
	// RETURNS: [void].
	// * id		- [string] Unique id of player.
	// * data	- [object] of key->name data to send to server.
	broadcastExcept( id, data ) {
		// Convert [object] data to json.
		const msg = JSON.stringify( data );
		this.wss.clients.forEach(
			client => {
				// Get player by client.
				if ( client.id!==id && client.readyState===WebSocket.OPEN ) {
					client.send( msg );
				}
			});
	}

	//----------------------------------
	// Generate Unique ID
	//----------------------------------
	// Creates base36 timestamp + random key
	// and ensures uniqueness within `skeys`.
	generateKey() {
		let skey, attempts = 0;
		do {
			// Generate random + timestamp-based key
			const rand = Math.random().toString(36).substring(2, 10); // 8-char random string
			const time = Date.now().toString(36); // timestamp in base36
			skey       = `${time}_${rand}`;
			/*if ( ++attempts>20 )
				throw new Error( "Failed to generate a unique key." );*/
		} while ( this.skeys.has(skey) );
		this.skeys.add( skey );
		return skey;
	}

	//----------------------------------
	// Release ID
	//----------------------------------
	// Frees up a previously reserved ID key.
	releaseKey( key ) {
		this.skeys.delete( key );
	}

	//----------------------------------
	// Log Client Count
	//----------------------------------
	// Outputs number of active connections.
	logClientCount() {
		console.log( "[JESTWebsocketServer] Connected clients:", this.wss.clients.size );
	}

	//----------------------------------
	// Clean Server Shutdown
	//----------------------------------
	// Closes all connections and shuts down the server.
	// RETURNS: [void].
	shutdown() {
		console.log( "[JESTWebsocketServer] Shutting down..." );
		// Close all active clients
		this.wss.clients.forEach(
			client => {
				if ( client.readyState === WebSocket.OPEN ) {
					client.close( 1001, "Server shutting down" ); // 1001 = Going Away
				}
			});
		// Close the server itself
		this.wss.close(
			() => {
				console.log( "[JESTWebsocketServer] Server closed." );
			});
	}
}

//----------------------------------
// Entry Point - Run server if file executed
//----------------------------------
// Start the server.
module.exports = JestWebsocketServer;
// Auto-start when run directly
if ( require.main===module ) {
	const server = new JestWebsocketServer( 8080 );
	// Handle kill signal: CTRL+C / process exit
	process.on(
		'SIGINT',
		() => {
			server.shutdown();
			process.exit();
		});
	process.on(
		'SIGTERM',
		() => {
			server.shutdown();
			process.exit();
		});
}
