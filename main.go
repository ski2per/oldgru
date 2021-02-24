package main

import (
	"fmt"
	"os"
	"time"

	"github.com/caarlos0/env"
	log "github.com/sirupsen/logrus"
	"github.com/ski2per/gru/minion"
)

var m = minion.Minion{}

func init() {
	// Init configuration from evnironmental variables
	// cfg := config{}
	if err := env.Parse(&m); err != nil {
		fmt.Printf("%+v\n", err)
	}

	if len(m.MinionID) <= 0 {
		hostname, err := os.Hostname()
		if err != nil {
			log.Error("Error while getting hostname")
			log.Errorln(err)
		}
		m.MinionID = hostname
	}

	// Init Logrus, default to INFO
	log.SetFormatter(&log.TextFormatter{
		FullTimestamp:   true,
		TimestampFormat: "2006-01-02 15:04:05.00000",
	})
	logLvl, err := log.ParseLevel(m.LogLevel)
	if err != nil {
		logLvl = log.InfoLevel
	}
	log.SetLevel(logLvl)
}

func main() {
	fmt.Printf("\nMinion: %s\n\n", minion.Version)

	log.Debugf("%+v\n", m)
	log.Info("Trying to get random reversed port from Gru")
	randomPort, err := m.GetRandomPort()
	for err != nil {
		time.Sleep(2 * time.Second)
		log.Error("Error while getting random port from Gru, retrying...")
		randomPort, err = m.GetRandomPort()
	} // Loop for getting random port

	log.Infof("Got random reversed port: %d\n", randomPort)

	internalIP := minion.GetLocalAddr()
	meta := minion.Meta{
		Name:       m.MinionID,
		Port:       randomPort,
		InternalIP: internalIP.String(),
	}
	// Debug for registration error
	// time.Sleep(20 * time.Second)

	err = m.Register(meta)
	for err != nil {
		err = m.Register(meta)
		time.Sleep(2 * time.Second)
	} // Loop for registration

	remote := minion.Endpoint{
		Username: m.GruUsername,
		Password: m.GruPassword,
		Host:     m.GruHost,
		Port:     m.GruSSHPort,
	}

	local := minion.Endpoint{
		Host: m.MinionHost,
		Port: m.MinionSSHPort,
	}

	// _, cancel := context.WithCancel(context.Background())

	// FIND NO WAY to exit blocked goroutine
	// wg := sync.WaitGroup{}
	// wg.Add(1)

	for {
		// minion.ConnectToGru(local, remote, cfg.GruReversePort)
		err := minion.ConnectToGru(local, remote, randomPort)
		if err != nil {
			log.Errorf("Lost connection to Gru, try to reconnect(port:%d)", randomPort)
			// m.Deregister(randomPort)
			time.Sleep(2 * time.Second)
		}
	}
}
