import type { Metadata } from "next";import "./globals.css";
export const metadata:Metadata={title:"Corrupt Drive — Recovery OS",description:"An IGCSE Computer Science recovery roguelite."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}