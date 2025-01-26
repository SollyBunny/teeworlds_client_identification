# Teeworlds Client Identification

A way for Teeworlds/DDNet clients to communicate with eachother

## How it works

On connect a client will send the server IP, name and it's own data to a TCI server

It will respond with any data it has about connected clients

Clients can ask about any new clients

## Server

In this repo there is a reference implementation of a TCI server written with NodeJS express

An instance of this will be hosted by the TClient community

## API

Currently this is implemented as HTTP(s) POST requests with a JSON body

All requests must be under 2048 bytes

Any errors are done with HTTP, with the error being plain text in the body

Formats are described with typescript but may not be enforced

You may get a 400 error for sending a malformed request

### Usage

Here is an outline on how to implement a client

1. After connecting to a server, send a init request
2. When a client joins, set a 3s timer (if another joins reset it)
3. Once the timer finishes or 30s with no timer send a update request with your token
4. If any relevant data changes, set a 5s timer (resetting if more changes)
5. Once the timer finishes send a data request with your token
6. On a name change, reset all timers and send another init request

Whilst browsing servers you can send init requests with neither user or data

Make sure to cache to avoid being rate limited

### ClientData

Each client is allowed up to 1024 bytes of data

This must be valid a JSON object with an `iden` key

The `iden` should be a short CamelCase string with no spaces or dashes, eg: `TClient`, `CactusClient`, `ChillerBotUX` but this is not enforced

```typescript
{
	iden: string,
	[key: string]: any
}
```

There are also more keys that clients may choose to respect

```typescript
{
	ver: string
	visual: {
		skin?: {
			six?: { // allows uncapped rgb
				skin: string,
				colored: boolean,
				colorFeet: number, // r << 16 + g << 8 + b
				colorBody: number, // r << 16 + g << 8 + b
			},
			seven?: {
				skinParts: {
					name: string,
					colored: boolean,
					color: number, // r << 16 + g << 8 + b
				}[],
			},
		},
		size?: "fat" | "mini" | string,
		rainbow?: {
			mode: "rainbow" | "pulse" | "black" | "random" | string,
			speed: number, // percentage * 100,
			what: ("tee" | "hook" | "weapon" | string)[],
		},
		trail?: {
			mode: "solid" | "tee" | "rainbow" | "speed" | "random" | string,
			rainbowSpeed?: number, // percentage * 100
			fadeAlpha: boolean = false,
			taperWidth: boolean = false,
		},
		pet?: {
			six?: {
				skin: string,
				colored: boolean,
				colorFeet: number, // r << 16 + g << 8 + b
				colorBody: number, // r << 16 + g << 8 + b
			},
			seven?: {
				skinParts: {
					name: string,
					colored: boolean,
					color: number, // r << 16 + g << 8 + b
				}[],
			},
		},
		[key: string]: string | any,
	}
}
```

### Init Request

Endpoint: `/init`

Request any data available for the players in the server of given address

If just name is specified, only data about that user will be returned if it exists

If name and data are specified, the user and clan will be checked against the address, and added to the data.

#### Init Request Format



Body:
```typescript
{
	address: string,
	name?: string,
	data?: ClientData,
}
```

#### Init Response Format

Code: `200`  
Body:
```typescript
{
	token?: string,
	clients: {
		name: string,
		data: ClientData,
	}[],
}
```

Code: `404` (Address not found)

Code: `404` (Name not found)

Code: `409` (Name already registered)

### Update Request Format

Endpoint: `/update`

3 seconds after player joins or after 30 seconds you may want to get any changes ie changed data, new players

A client with no data is one is one which has either left or removed it's data

#### Update Request Format

Header: `Authorization: Bearer ${token}`

No body required

#### Update Response Format

Code: `200`  
Body:
```typescript
{
	clients: {
		name: string,
		data?: ClientData,
	}[],
}
```

### Set Request Format

A client may want to update it's data, if something changes, eg: changed appearance setting

Note that most clients will not see this change until a player joins or up to 30 seconds pass

An empty body or neither data will remove the client's data

#### Set Request Format

Header: `Authorization: Bearer ${token}`  
Body:
```typescript
{
	data?: ClientData,
}
```

#### Set Response Format

Code: `200` (Okay)
