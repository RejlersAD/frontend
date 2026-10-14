import { createContext, useContext } from 'react'

export const ProfilePhotoContext = createContext({ photo: null, userId: null })
export const useCurrentProfilePhoto = () => useContext(ProfilePhotoContext)
