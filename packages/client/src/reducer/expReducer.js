const initializtion = { expiration: "--", loading: false };
export default function expReducer(state = initializtion, action) {
  switch (action.type) {
    case "update":
      return {...state, expiration: action.payload.expiration}
    case "loading":
      return {...state, loading: true}
    case "loaded":
      return {...state, loading: false}
    default:
      return state
  }
}